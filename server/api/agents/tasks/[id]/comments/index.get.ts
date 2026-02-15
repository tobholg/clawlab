import { prisma } from '../../../../../utils/prisma'
import { getDisplayName, requireAgentUser, requireAssignedTask } from '../../../../../utils/agentApi'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const agent = requireAgentUser(event)
  await requireAssignedTask(agent.id, taskId)

  const query = getQuery(event)
  const parsedLimit = Number(query.limit)
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsedLimit)))
    : DEFAULT_LIMIT
  const before = typeof query.before === 'string' ? query.before : undefined

  let beforeCursor: { id: string; createdAt: Date } | null = null
  if (before) {
    beforeCursor = await prisma.comment.findFirst({
      where: {
        id: before,
        itemId: taskId,
      },
      select: {
        id: true,
        createdAt: true,
      },
    })

    if (!beforeCursor) {
      throw createError({ statusCode: 400, message: 'Invalid before cursor' })
    }
  }

  const comments = await prisma.comment.findMany({
    where: {
      itemId: taskId,
      ...(beforeCursor
        ? {
            OR: [
              { createdAt: { lt: beforeCursor.createdAt } },
              {
                createdAt: beforeCursor.createdAt,
                id: { lt: beforeCursor.id },
              },
            ],
          }
        : {}),
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  })

  const hasMore = comments.length > limit
  const page = hasMore ? comments.slice(0, limit) : comments

  return {
    comments: page.map((comment) => ({
      id: comment.id,
      content: comment.content,
      parentCommentId: comment.parentCommentId,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      user: {
        id: comment.user.id,
        name: getDisplayName(comment.user),
        avatar: comment.user.avatar,
      },
    })),
    nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
  }
})
