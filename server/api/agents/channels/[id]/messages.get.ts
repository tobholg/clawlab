import { prisma } from '../../../../utils/prisma'
import { requireAgentUser } from '../../../../utils/agentApi'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')
  if (!channelId) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  const agent = requireAgentUser(event)
  const query = getQuery(event)

  const parsedLimit = Number(query.limit)
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsedLimit)))
    : DEFAULT_LIMIT

  const before = typeof query.before === 'string' ? query.before : undefined
  const since = typeof query.since === 'string' ? query.since : undefined
  const mentionsMe = query.mentionsMe === 'true'

  const membership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId: agent.id,
      },
    },
    select: { id: true },
  })

  if (!membership) {
    throw createError({ statusCode: 403, message: 'Access denied' })
  }

  const whereClause: Record<string, unknown> = {
    channelId,
    deleted: false,
    parentId: null,
  }

  if (since) {
    const parsedSince = new Date(since)
    if (Number.isNaN(parsedSince.getTime())) {
      throw createError({ statusCode: 400, message: 'Invalid since parameter' })
    }
    whereClause.createdAt = { gte: parsedSince }
  }

  if (before) {
    const cursorMessage = await prisma.message.findFirst({
      where: {
        id: before,
        channelId,
      },
      select: { createdAt: true },
    })

    if (!cursorMessage) {
      throw createError({ statusCode: 400, message: 'Invalid before cursor' })
    }

    whereClause.createdAt = {
      ...(typeof whereClause.createdAt === 'object' ? (whereClause.createdAt as object) : {}),
      lt: cursorMessage.createdAt,
    }
  }

  if (mentionsMe) {
    whereClause.mentions = {
      some: { userId: agent.id },
    }
  }

  const messages = await prisma.message.findMany({
    where: whereClause,
    include: {
      user: {
        select: { id: true, name: true, avatar: true, isAgent: true, agentProvider: true },
      },
      mentions: {
        include: {
          user: {
            select: { id: true, name: true, avatar: true, isAgent: true, agentProvider: true },
          },
        },
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
      mentions: msg.mentions.map((mention) => ({
        userId: mention.userId,
        user: mention.user,
      })),
      replyCount: msg._count.replies,
      reactions: groupReactions(msg.reactions),
    })),
    hasMore: messages.length === limit,
    nextCursor: messages.length > 0 ? messages[0].id : null,
  }
})

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
