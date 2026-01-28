import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')
  const query = getQuery(event)

  const limit = Math.min(parseInt(query.limit as string) || 50, 100)
  const before = query.before as string | undefined

  if (!channelId) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  // Verify channel exists
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  })

  if (!channel) {
    throw createError({ statusCode: 404, message: 'Channel not found' })
  }

  // Build cursor-based pagination
  const whereClause: Record<string, unknown> = {
    channelId,
    deleted: false,
    parentId: null, // Only top-level messages
  }

  if (before) {
    const cursorMessage = await prisma.message.findUnique({
      where: { id: before },
      select: { createdAt: true },
    })
    if (cursorMessage) {
      whereClause.createdAt = { lt: cursorMessage.createdAt }
    }
  }

  const messages = await prisma.message.findMany({
    where: whereClause,
    include: {
      user: {
        select: { id: true, name: true, avatar: true },
      },
      _count: {
        select: { replies: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  // Reverse to get chronological order
  const chronological = messages.reverse()

  return {
    messages: chronological.map((msg) => ({
      id: msg.id,
      channelId: msg.channelId,
      userId: msg.userId,
      parentId: msg.parentId,
      content: msg.content,
      attachments: msg.attachments,
      createdAt: msg.createdAt.toISOString(),
      updatedAt: msg.updatedAt.toISOString(),
      editedAt: msg.editedAt?.toISOString() ?? null,
      user: msg.user,
      replyCount: msg._count.replies,
    })),
    hasMore: messages.length === limit,
    nextCursor: messages.length > 0 ? messages[0].id : null,
  }
})
