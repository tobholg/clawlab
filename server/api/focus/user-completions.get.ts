// GET /api/focus/user-completions - Completed tasks for a user (admin only)
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

const ADMIN_ROLES = new Set(['OWNER', 'ADMIN'])

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string
  const userId = query.userId as string
  const projectId = (query.projectId as string | undefined) || undefined
  const days = Number(query.days) || 14

  if (!workspaceId || !userId) {
    throw createError({ statusCode: 400, message: 'workspaceId and userId are required' })
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: sessionUser.id,
      }
    },
    select: { role: true },
  })

  if (!membership || !ADMIN_ROLES.has(membership.role)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const targetMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      }
    },
    select: { userId: true },
  })

  if (!targetMember) {
    throw createError({ statusCode: 404, message: 'User not in workspace' })
  }

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (days - 1))
  startDate.setHours(0, 0, 0, 0)

  const assignmentFilter = {
    OR: [
      { ownerId: userId },
      { assignees: { some: { userId } } },
    ]
  }

  const projectFilter = projectId
    ? { OR: [{ projectId }, { id: projectId }] }
    : null

  const completedItems = await prisma.item.findMany({
    where: {
      workspaceId,
      completedAt: { gte: startDate },
      status: 'DONE',
      ...assignmentFilter,
      ...(projectFilter ? { AND: [projectFilter] } : {}),
    },
    select: {
      id: true,
      title: true,
      completedAt: true,
      ownerId: true,
    },
    orderBy: { completedAt: 'asc' },
  })

  const completedItemIds = completedItems.map((item) => item.id)

  const focusSessions = completedItemIds.length
    ? await prisma.focusSession.findMany({
        where: {
          taskId: { in: completedItemIds },
          userId,
          endedAt: { not: null },
        },
        select: {
          taskId: true,
          startedAt: true,
          endedAt: true,
        }
      })
    : []

  const focusTimeByItem: Record<string, number> = {}
  for (const session of focusSessions) {
    if (!session.taskId || !session.endedAt) continue
    const duration = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
    focusTimeByItem[session.taskId] = (focusTimeByItem[session.taskId] || 0) + duration
  }

  const dailyCompletions: Record<string, Array<{
    id: string
    title: string
    completedAt: Date
    timeWorked: number
    isOwner: boolean
  }>> = {}

  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    dailyCompletions[formatLocalDate(date)] = []
  }

  for (const item of completedItems) {
    if (!item.completedAt) continue
    const dayKey = formatLocalDate(new Date(item.completedAt))
    if (!dailyCompletions[dayKey]) continue

    const timeWorkedMs = focusTimeByItem[item.id] || 0
    const timeWorkedMinutes = Math.round(timeWorkedMs / (1000 * 60))

    dailyCompletions[dayKey].push({
      id: item.id,
      title: item.title,
      completedAt: item.completedAt,
      timeWorked: timeWorkedMinutes,
      isOwner: item.ownerId === userId,
    })
  }

  const heatmap = Object.entries(dailyCompletions).map(([date, completions]) => ({
    date,
    count: completions.length,
    intensity: Math.min(4, completions.length),
    completions,
  }))

  const totalCompletions = heatmap.reduce((sum, d) => sum + d.count, 0)

  return {
    workspaceId,
    userId,
    projectId: projectId ?? null,
    days,
    heatmap,
    totalCompletions,
  }
})
