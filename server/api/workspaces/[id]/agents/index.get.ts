import { requireMinRole, requireWorkspaceMember } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

const ONLINE_WINDOW_MS = 10 * 60 * 1000

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)
  requireMinRole(auth, 'ADMIN')

  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      status: 'ACTIVE',
      user: { isAgent: true },
    },
    select: {
      userId: true,
      joinedAt: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          agentProvider: true,
          runnerCommand: true,
          runnerArgs: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  if (!members.length) {
    return []
  }

  const userIds = members.map((member) => member.userId)

  const [taskCounts, latestActivities, latestComments, latestEdits] = await Promise.all([
    prisma.itemAssignment.groupBy({
      by: ['userId'],
      where: {
        userId: { in: userIds },
        item: {
          workspaceId,
          parentId: { not: null },
          status: { not: 'DONE' },
        },
      },
      _count: { _all: true },
    }),
    prisma.activity.findMany({
      where: { userId: { in: userIds }, item: { workspaceId } },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId'],
    }),
    prisma.comment.findMany({
      where: { userId: { in: userIds }, item: { workspaceId } },
      select: { userId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      distinct: ['userId'],
    }),
    prisma.document.findMany({
      where: { lastEditedById: { in: userIds }, item: { workspaceId } },
      select: { lastEditedById: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      distinct: ['lastEditedById'],
    }),
  ])

  const assignedTaskCountByUser = new Map<string, number>()
  for (const row of taskCounts) {
    assignedTaskCountByUser.set(row.userId, row._count._all)
  }

  const activityByUser = new Map<string, Date>()
  for (const row of latestActivities) {
    activityByUser.set(row.userId, row.createdAt)
  }

  for (const row of latestComments) {
    const current = activityByUser.get(row.userId)
    if (!current || row.createdAt > current) {
      activityByUser.set(row.userId, row.createdAt)
    }
  }

  for (const row of latestEdits) {
    if (!row.lastEditedById) continue
    const current = activityByUser.get(row.lastEditedById)
    if (!current || row.updatedAt > current) {
      activityByUser.set(row.lastEditedById, row.updatedAt)
    }
  }

  const now = Date.now()

  return members.map((member) => {
    const name = member.user.name ?? member.user.email.split('@')[0]
    const lastActiveAt = activityByUser.get(member.userId) ?? member.user.updatedAt
    const isOnline = now - lastActiveAt.getTime() <= ONLINE_WINDOW_MS

    return {
      id: member.user.id,
      name,
      provider: member.user.agentProvider ?? 'custom',
      agentProvider: member.user.agentProvider,
      runnerCommand: member.user.runnerCommand,
      runnerArgs: member.user.runnerArgs,
      avatar: member.user.avatar,
      assignedTasks: assignedTaskCountByUser.get(member.userId) ?? 0,
      status: isOnline ? 'online' : 'offline',
      lastActiveAt: lastActiveAt.toISOString(),
      joinedAt: member.joinedAt.toISOString(),
    }
  })
})
