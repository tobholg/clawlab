import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string
  const cursor = query.cursor as string | undefined
  const limit = Math.min(Number(query.limit) || 30, 50)
  const type = query.type as string | undefined

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  // Verify membership
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } }
  })

  if (!membership || membership.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, message: 'Not a workspace member' })
  }

  const where: any = {
    item: { workspaceId },
  }

  if (type) {
    where.type = type
  }

  if (cursor) {
    where.createdAt = { lt: new Date(cursor) }
  }

  const activities = await prisma.activity.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
      item: {
        select: {
          id: true,
          title: true,
          parentId: true,
          projectId: true,
          parent: { select: { title: true } },
        }
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  })

  const hasMore = activities.length > limit
  const items = hasMore ? activities.slice(0, limit) : activities

  return {
    activities: items.map(a => ({
      id: a.id,
      type: a.type,
      oldValue: a.oldValue,
      newValue: a.newValue,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
      user: {
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        avatar: a.user.avatar,
      },
      item: {
        id: a.item.id,
        title: a.item.title,
        isProject: !a.item.parentId,
        parentTitle: a.item.parent?.title || null,
        projectId: a.item.projectId,
      },
    })),
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  }
})
