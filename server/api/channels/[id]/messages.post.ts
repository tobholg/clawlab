import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForChannel } from '../../../utils/auth'
import { broadcastNewMessage } from '../../../utils/websocket'

const MAX_MESSAGE_LENGTH = 5000

interface CreateMessageBody {
  content: string
  parentId?: string
}

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')

  if (!channelId) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  const { user } = await requireWorkspaceMemberForChannel(event, channelId)

  const body = await readBody<CreateMessageBody>(event)

  if (!body.content?.trim()) {
    throw createError({ statusCode: 400, message: 'content is required' })
  }

  if (body.content.length > MAX_MESSAGE_LENGTH) {
    throw createError({ statusCode: 400, message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` })
  }

  // If parentId provided, verify it exists
  if (body.parentId) {
    const parentMessage = await prisma.message.findFirst({
      where: {
        id: body.parentId,
        channelId,
        deleted: false,
      },
    })
    if (!parentMessage) {
      throw createError({ statusCode: 400, message: 'Parent message not found' })
    }
  }

  const message = await prisma.message.create({
    data: {
      channelId,
      userId: user.id,
      content: body.content.trim(),
      parentId: body.parentId || null,
    },
    include: {
      user: {
        select: { id: true, name: true, avatar: true },
      },
      _count: {
        select: { replies: true },
      },
    },
  })

  const formattedMessage = {
    id: message.id,
    channelId: message.channelId,
    userId: message.userId,
    parentId: message.parentId,
    content: message.content,
    attachments: message.attachments,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    user: message.user,
    replyCount: message._count.replies,
  }

  // Broadcast to WebSocket clients
  broadcastNewMessage(channelId, formattedMessage, user.id)

  return formattedMessage
})
