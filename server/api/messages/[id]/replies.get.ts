import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForChannel } from '../../../utils/auth'
import { messageAttachmentSelect, toMessageAttachmentResponse } from '../../../utils/attachments'

export default defineEventHandler(async (event) => {
  const messageId = getRouterParam(event, 'id')

  if (!messageId) {
    throw createError({ statusCode: 400, message: 'Message ID is required' })
  }

  // Look up message's channel to verify workspace membership
  const msgForAuth = await prisma.message.findUnique({
    where: { id: messageId },
    select: { channelId: true },
  })
  if (!msgForAuth) {
    throw createError({ statusCode: 404, message: 'Message not found' })
  }
  await requireWorkspaceMemberForChannel(event, msgForAuth.channelId)

  // Get parent message with replies
  const parentMessage = await prisma.message.findUnique({
    where: { id: messageId, deleted: false },
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
      attachments: {
        select: messageAttachmentSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
      replies: {
        where: { deleted: false },
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
          attachments: {
            select: messageAttachmentSelect,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: { replies: true },
      },
    },
  })

  if (!parentMessage) {
    throw createError({ statusCode: 404, message: 'Message not found' })
  }

  const formatMessage = (msg: typeof parentMessage | typeof parentMessage.replies[0]) => ({
    id: msg.id,
    channelId: msg.channelId,
    userId: msg.userId,
    parentId: msg.parentId,
    content: msg.content,
    embeds: msg.embeds,
    attachments: msg.attachments.map(toMessageAttachmentResponse),
    createdAt: msg.createdAt.toISOString(),
    updatedAt: msg.updatedAt.toISOString(),
    editedAt: msg.editedAt?.toISOString() ?? null,
    user: msg.user,
    mentions: msg.mentions.map((mention) => ({
      userId: mention.userId,
      user: mention.user,
    })),
    replyCount: '_count' in msg ? msg._count.replies : 0,
  })

  return {
    parent: formatMessage(parentMessage),
    replies: parentMessage.replies.map(formatMessage),
  }
})
