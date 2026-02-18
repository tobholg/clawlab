// GET /api/focus/team-history - Get focus session history for a workspace team (admin only)
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN'])

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string
  const projectId = (query.projectId as string | undefined) || undefined
  const days = parseInt(query.days as string) || 7

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.id,
      }
    },
    select: { role: true, status: true },
  })

  if (!membership || membership.status !== 'ACTIVE' || !ADMIN_ROLES.has(membership.role)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  let projectTitle: string | null = null
  let projectAssigneeIds = new Set<string>()

  if (projectId) {
    const project = await prisma.item.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        workspaceId: true,
        ownerId: true,
        assignees: { select: { userId: true } },
      }
    })

    if (!project || project.workspaceId !== workspaceId) {
      throw createError({ statusCode: 404, message: 'Project not found in workspace' })
    }

    projectTitle = project.title
    if (project.ownerId) projectAssigneeIds.add(project.ownerId)
    project.assignees.forEach((a) => projectAssigneeIds.add(a.userId))
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const workspaceMembers = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: 'ACTIVE' },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true, isAgent: true }
      }
    }
  })

  const memberIds = workspaceMembers.map((m) => m.userId)
  if (!memberIds.length) {
    return {
      workspaceId,
      project: projectId ? { id: projectId, title: projectTitle } : null,
      days,
      stats: {
        totalHours: 0,
        taskHours: 0,
        meetingHours: 0,
        sessions: 0,
        activeMembers: 0,
      },
      members: [],
    }
  }

  const sessionWhere: any = {
    userId: { in: memberIds },
    startedAt: { gte: startDate },
  }

  if (projectId) {
    sessionWhere.projectId = projectId
  }

  const sessions = await prisma.focusSession.findMany({
    where: sessionWhere,
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
      task: { select: { id: true, title: true, status: true } },
      project: { select: { id: true, title: true } },
    },
    orderBy: { startedAt: 'asc' },
  })

  const activeItems = await prisma.item.findMany({
    where: {
      workspaceId,
      parentId: { not: null },
      status: { not: 'DONE' },
      ...(projectId ? { projectId } : {}),
      OR: [
        { ownerId: { in: memberIds } },
        { assignees: { some: { userId: { in: memberIds } } } },
      ],
    },
    include: {
      assignees: { select: { userId: true } },
    },
  })

  const projectIds = new Set<string>()
  activeItems.forEach((item) => {
    const pid = item.projectId ?? item.parentId
    if (pid) projectIds.add(pid)
  })

  const projects = projectIds.size
    ? await prisma.item.findMany({
        where: { id: { in: Array.from(projectIds) } },
        select: { id: true, title: true, ownerId: true },
      })
    : []

  const projectTitleById = new Map<string, string>()
  const projectOwnerById = new Map<string, string | null>()
  projects.forEach((project) => {
    projectTitleById.set(project.id, project.title)
    projectOwnerById.set(project.id, project.ownerId ?? null)
  })

  const membersMap = new Map<string, any>()
  const now = new Date()

  for (const member of workspaceMembers) {
    const user = member.user
    const userName = user.name ?? user.email?.split('@')[0] ?? 'User'
    membersMap.set(member.userId, {
      userId: member.userId,
      name: userName,
      avatar: user.avatar ?? null,
      isAgent: user.isAgent ?? false,
      totals: {
        totalMins: 0,
        taskMins: 0,
        meetingMins: 0,
        generalMins: 0,
        adminMins: 0,
        learningMins: 0,
        breakMins: 0,
        sessions: 0,
        completedTasks: 0,
      },
      timelineByDate: new Map<string, any[]>(),
      isProjectAssignee: projectId ? projectAssigneeIds.has(member.userId) : null,
      currentTasksById: new Map<string, any>(),
      agentSessions: [] as any[],
    })
  }

  for (const session of sessions) {
    const durationMs = session.endedAt
      ? session.endedAt.getTime() - session.startedAt.getTime()
      : now.getTime() - session.startedAt.getTime()
    const durationMins = Math.max(0, Math.round(durationMs / 60000))

    const userId = session.userId
    const userName = session.user.name ?? session.user.email?.split('@')[0] ?? 'User'
    const dateKey = session.startedAt.toISOString().split('T')[0]

    if (!membersMap.has(userId)) {
      membersMap.set(userId, {
        userId,
        name: userName,
        avatar: session.user.avatar ?? null,
        totals: {
          totalMins: 0,
          taskMins: 0,
          meetingMins: 0,
          sessions: 0,
        },
        timelineByDate: new Map<string, any[]>(),
        isProjectAssignee: projectId ? projectAssigneeIds.has(userId) : null,
      })
    }

    const entry = membersMap.get(userId)
    entry.totals.totalMins += durationMins
    if (session.activityType === 'TASK') {
      entry.totals.taskMins += durationMins
      if (session.endReason === 'COMPLETED') entry.totals.completedTasks += 1
    }
    if (session.lane === 'MEETING') entry.totals.meetingMins += durationMins
    if (session.lane === 'GENERAL') entry.totals.generalMins += durationMins
    if (session.lane === 'ADMIN') entry.totals.adminMins += durationMins
    if (session.lane === 'LEARNING') entry.totals.learningMins += durationMins
    if (session.lane === 'BREAK') entry.totals.breakMins += durationMins
    entry.totals.sessions += 1

    if (!entry.timelineByDate.has(dateKey)) {
      entry.timelineByDate.set(dateKey, [])
    }

    entry.timelineByDate.get(dateKey).push({
      id: session.id,
      activityType: session.activityType,
      lane: session.lane,
      task: session.task,
      project: session.project,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
      durationMins,
      endReason: session.endReason,
      comment: session.comment,
      commentedAt: session.commentedAt?.toISOString() ?? null,
      isActive: !session.endedAt,
    })
  }

  // Fetch agent sessions for agent members
  const agentMemberIds = workspaceMembers
    .filter((m) => m.user.isAgent)
    .map((m) => m.userId)

  if (agentMemberIds.length) {
    const agentSessionWhere: any = {
      agentId: { in: agentMemberIds },
      createdAt: { gte: startDate },
    }
    if (projectId) {
      agentSessionWhere.projectId = projectId
    }

    const agentSessions = await prisma.agentSession.findMany({
      where: agentSessionWhere,
      include: {
        item: { select: { id: true, title: true, status: true } },
        agent: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    for (const as of agentSessions) {
      const member = membersMap.get(as.agentId)
      if (!member) continue

      const startTime = as.checkedOutAt ?? as.createdAt
      const endTime = as.completedAt ?? (as.status === 'ACTIVE' ? now : as.createdAt)
      const durationMs = endTime.getTime() - startTime.getTime()
      const durationMins = Math.max(0, Math.round(durationMs / 60000))

      member.agentSessions.push({
        id: as.id,
        status: as.status,
        taskId: as.itemId,
        task: as.item ? { id: as.item.id, title: as.item.title, status: as.item.status } : null,
        terminalId: as.terminalId,
        checkedOutAt: startTime.toISOString(),
        completedAt: as.completedAt?.toISOString() ?? null,
        durationMins,
        isActive: as.status === 'ACTIVE',
      })

      // Count agent session time in totals
      member.totals.totalMins += durationMins
      member.totals.taskMins += durationMins
      member.totals.sessions += 1

      // Add to timeline
      const dateKey = startTime.toISOString().split('T')[0]
      if (!member.timelineByDate.has(dateKey)) {
        member.timelineByDate.set(dateKey, [])
      }
      member.timelineByDate.get(dateKey).push({
        id: as.id,
        activityType: 'AGENT_SESSION',
        lane: null,
        task: as.item ? { id: as.item.id, title: as.item.title, status: as.item.status } : null,
        project: null,
        startedAt: startTime.toISOString(),
        endedAt: as.completedAt?.toISOString() ?? null,
        durationMins,
        endReason: as.status === 'TERMINATED' ? 'TERMINATED' : as.status === 'AWAITING_REVIEW' ? 'COMPLETED' : null,
        comment: null,
        commentedAt: null,
        isActive: as.status === 'ACTIVE',
        agentSessionStatus: as.status,
      })
    }
  }

  for (const item of activeItems) {
    const resolvedProjectId = item.projectId ?? item.parentId ?? null
    const taskEntry = {
      id: item.id,
      title: item.title,
      status: item.status.toLowerCase(),
      category: item.category,
      dueDate: item.dueDate?.toISOString() ?? null,
      startDate: item.startDate?.toISOString() ?? null,
      progress: item.progress ?? 0,
      confidence: item.confidence ?? 70,
      priority: item.priority ?? null,
      complexity: item.complexity ?? null,
      projectId: resolvedProjectId,
      projectTitle: resolvedProjectId
        ? projectTitleById.get(resolvedProjectId) ?? 'Project'
        : 'Project',
      projectOwnerId: resolvedProjectId ? projectOwnerById.get(resolvedProjectId) ?? null : null,
    }

    const assigneeIds = new Set(item.assignees.map((a) => a.userId))

    const addTaskForUser = (userId: string, role: 'owner' | 'assignee') => {
      if (!membersMap.has(userId)) return
      const member = membersMap.get(userId)
      const existing = member.currentTasksById.get(taskEntry.id)
      if (existing) {
        if (role === 'owner') existing.isOwner = true
        if (role === 'assignee') existing.isAssignee = true
        return
      }
      member.currentTasksById.set(taskEntry.id, {
        ...taskEntry,
        isOwner: role === 'owner',
        isAssignee: role === 'assignee',
      })
    }

    if (item.ownerId) addTaskForUser(item.ownerId, 'owner')
    for (const userId of assigneeIds) {
      addTaskForUser(userId, 'assignee')
    }
  }

  const members = Array.from(membersMap.values()).map((member) => {
    const timeline = Array.from(member.timelineByDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, daySessions]) => ({
        date,
        sessions: daySessions
          .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
      }))

    return {
      userId: member.userId,
      name: member.name,
      avatar: member.avatar,
      totals: {
        totalHours: roundHours(member.totals.totalMins),
        taskHours: roundHours(member.totals.taskMins),
        meetingHours: roundHours(member.totals.meetingMins),
        generalHours: roundHours(member.totals.generalMins),
        adminHours: roundHours(member.totals.adminMins),
        learningHours: roundHours(member.totals.learningMins),
        breakHours: roundHours(member.totals.breakMins),
        sessions: member.totals.sessions,
        completedTasks: member.totals.completedTasks,
      },
      isAgent: member.isAgent,
      isProjectAssignee: member.isProjectAssignee,
      timeline,
      currentTasks: Array.from(member.currentTasksById.values()),
      agentSessions: member.agentSessions,
    }
  })

  members.sort((a, b) => b.totals.totalHours - a.totals.totalHours)

  const rawStats = members.reduce(
    (acc, member) => {
      acc.totalHours += member.totals.totalHours
      acc.taskHours += member.totals.taskHours
      acc.meetingHours += member.totals.meetingHours
      acc.sessions += member.totals.sessions
      if (member.totals.totalHours > 0) acc.activeMembers += 1
      return acc
    },
    { totalHours: 0, taskHours: 0, meetingHours: 0, sessions: 0, activeMembers: 0 }
  )

  // Round aggregated floats to avoid floating point drift (e.g. 9.200000000000001)
  const stats = {
    ...rawStats,
    totalHours: parseFloat(rawStats.totalHours.toFixed(1)),
    taskHours: parseFloat(rawStats.taskHours.toFixed(1)),
    meetingHours: parseFloat(rawStats.meetingHours.toFixed(1)),
  }

  return {
    workspaceId,
    project: projectId ? { id: projectId, title: projectTitle } : null,
    days,
    stats,
    members,
  }
})

function roundHours(mins: number) {
  return parseFloat((mins / 60).toFixed(1))
}
