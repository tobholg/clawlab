import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/auth'
import { broadcast } from '../../../utils/websocket'

interface ReactionBody {
  emoji: string
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const messageId = getRouterParam(event, 'id')
  const body = await readBody<ReactionBody>(event)

  if (!messageId) {
    throw createError({ statusCode: 400, message: 'Message ID is required' })
  }

  if (!body.emoji?.trim()) {
    throw createError({ statusCode: 400, message: 'emoji is required' })
  }

  // Verify message exists
  const message = await prisma.message.findUnique({
    where: { id: messageId, deleted: false },
    select: { id: true, channelId: true },
  })

  if (!message) {
    throw createError({ statusCode: 404, message: 'Message not found' })
  }

  // Toggle reaction (add if not exists, remove if exists)
  const existingReaction = await prisma.reaction.findUnique({
    where: {
      messageId_userId_emoji: {
        messageId,
        userId: user.id,
        emoji: body.emoji.trim(),
      },
    },
  })
  console.log('[Reactions] Checking existing reaction for user:', user.id, 'emoji:', body.emoji, ':', existingReaction ? 'FOUND' : 'NOT FOUND')

  let action: 'added' | 'removed'
  
  if (existingReaction) {
    // Remove reaction
    console.log('[Reactions] Deleting existing reaction:', existingReaction.id)
    await prisma.reaction.delete({
      where: { id: existingReaction.id },
    })
    action = 'removed'
  } else {
    // Add reaction
    const newReaction = await prisma.reaction.create({
      data: {
        messageId,
        userId: user.id,
        emoji: body.emoji.trim(),
      },
    })
    console.log('[Reactions] Created reaction:', newReaction.id, 'for message:', messageId)
    action = 'added'
  }

  // Get updated reactions for the message
  const reactions = await getMessageReactions(messageId)

  // Broadcast to channel
  console.log('[Reactions] Broadcasting to channel:', message.channelId, 'messageId:', messageId, 'reactions:', reactions.length)
  broadcast({
    type: 'reaction_update',
    channelId: message.channelId,
    messageId,
    reactions,
  })

  return { action, reactions }
})

// Helper to get aggregated reactions for a message
async function getMessageReactions(messageId: string) {
  const reactions = await prisma.reaction.findMany({
    where: { messageId },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Group by emoji
  const grouped = new Map<string, { emoji: string; count: number; users: { id: string; name: string | null }[]; reacted: boolean }>()
  
  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji)
    if (existing) {
      existing.count++
      existing.users.push({ id: reaction.user.id, name: reaction.user.name })
    } else {
      grouped.set(reaction.emoji, {
        emoji: reaction.emoji,
        count: 1,
        users: [{ id: reaction.user.id, name: reaction.user.name }],
        reacted: false, // Will be set by client
      })
    }
  }

  return Array.from(grouped.values())
}

export { getMessageReactions }
