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

  console.log('[Messages GET] Fetching messages for channel:', channelId)
  
  // Debug: directly query reactions table
  const allReactions = await prisma.reaction.findMany({ take: 10 })
  console.log('[Messages GET] All reactions in DB:', allReactions.length, allReactions.map(r => ({ id: r.id.slice(-8), msgId: r.messageId.slice(-8) })))
  const messages = await prisma.message.findMany({
    where: whereClause,
    include: {
      user: {
        select: { id: true, name: true, avatar: true },
      },
      _count: {
        select: { replies: true },
      },
      reactions: {
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  console.log('[Messages GET] Found', messages.length, 'messages, reactions counts:', messages.map(m => ({ id: m.id.slice(-8), reactions: m.reactions.length })))

  // Reverse to get chronological order
  const chronological = messages.reverse()

  const result = {
    messages: chronological.map((msg) => {
      const grouped = groupReactions(msg.reactions)
      if (grouped.length > 0) {
        console.log('[Messages GET] Message', msg.id, 'has reactions:', grouped)
      }
      return {
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
        reactions: grouped,
      }
    }),
    hasMore: messages.length === limit,
    nextCursor: messages.length > 0 ? messages[0].id : null,
  }
  return result
})

// Group reactions by emoji
function groupReactions(reactions: { emoji: string; user: { id: string; name: string | null } }[]) {
  const grouped = new Map<string, { emoji: string; count: number; users: { id: string; name: string | null }[] }>()
  
  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji)
    if (existing) {
      existing.count++
      existing.users.push(reaction.user)
    } else {
      grouped.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 1,
        users: [reaction.user],
      })
    }
  }

  return Array.from(grouped.values())
}
