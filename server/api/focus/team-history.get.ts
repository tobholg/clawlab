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
    select: { role: true },
  })

  if (!membership || !ADMIN_ROLES.has(membership.role)) {
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
    where: { workspaceId },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true }
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

  const membersMap = new Map<string, any>()
  const now = new Date()

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
    if (session.activityType === 'TASK') entry.totals.taskMins += durationMins
    if (session.lane === 'MEETING') entry.totals.meetingMins += durationMins
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

  const members = Array.from(membersMap.values()).map((member) => {
    const timeline = Array.from(member.timelineByDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, daySessions]) => ({
        date,
        sessions: daySessions
          .sort((a: any, b: any) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()),
      }))

    return {
      userId: member.userId,
      name: member.name,
      avatar: member.avatar,
      totals: {
        totalHours: roundHours(member.totals.totalMins),
        taskHours: roundHours(member.totals.taskMins),
        meetingHours: roundHours(member.totals.meetingMins),
        sessions: member.totals.sessions,
      },
      isProjectAssignee: member.isProjectAssignee,
      timeline,
    }
  })

  members.sort((a, b) => b.totals.totalHours - a.totals.totalHours)

  const stats = members.reduce(
    (acc, member) => {
      acc.totalHours += member.totals.totalHours
      acc.taskHours += member.totals.taskHours
      acc.meetingHours += member.totals.meetingHours
      acc.sessions += member.totals.sessions
      return acc
    },
    { totalHours: 0, taskHours: 0, meetingHours: 0, sessions: 0 }
  )

  return {
    workspaceId,
    project: projectId ? { id: projectId, title: projectTitle } : null,
    days,
    stats: {
      ...stats,
      activeMembers: members.length,
    },
    members,
  }
})

function roundHours(mins: number) {
  return Math.round((mins / 60) * 10) / 10
}
