import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForChannel } from '../../../utils/auth'
import { messageAttachmentSelect, toMessageAttachmentResponse } from '../../../utils/attachments'
import { broadcast, broadcastNewMessage } from '../../../utils/websocket'
import { createMentions, extractMentionIds } from '../../../utils/mentions'

const MAX_MESSAGE_LENGTH = 5000

interface CreateMessageBody {
  content?: string
  parentId?: string
  attachmentIds?: string[]
}

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')

  if (!channelId) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  const { user } = await requireWorkspaceMemberForChannel(event, channelId)

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      displayName: true,
    },
  })

  if (!channel) {
    throw createError({ statusCode: 404, message: 'Channel not found' })
  }

  const body = await readBody<CreateMessageBody>(event)
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const attachmentIds = Array.isArray(body.attachmentIds)
    ? Array.from(
        new Set(
          body.attachmentIds
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.trim())
            .filter((id) => id.length > 0),
        ),
      )
    : []

  if (!content && attachmentIds.length === 0) {
    throw createError({ statusCode: 400, message: 'content or attachmentIds is required' })
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
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

  if (attachmentIds.length > 0) {
    const existing = await prisma.attachment.findMany({
      where: {
        id: { in: attachmentIds },
        uploadedById: user.id,
        itemId: null,
        messageId: null,
      },
      select: { id: true },
    })

    if (existing.length !== attachmentIds.length) {
      throw createError({ statusCode: 400, message: 'Some attachments are invalid or already linked' })
    }
  }

  const createdMessage = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        channelId,
        userId: user.id,
        content,
        parentId: body.parentId || null,
      },
    })

    if (attachmentIds.length > 0) {
      const updated = await tx.attachment.updateMany({
        where: {
          id: { in: attachmentIds },
          uploadedById: user.id,
          itemId: null,
          messageId: null,
        },
        data: {
          messageId: created.id,
        },
      })

      if (updated.count !== attachmentIds.length) {
        throw createError({ statusCode: 400, message: 'Failed to link all attachments' })
      }
    }

    return created
  })

  await createMentions(createdMessage.id, createdMessage.content)

  const message = await prisma.message.findUniqueOrThrow({
    where: { id: createdMessage.id },
    include: {
      user: {
        select: { id: true, name: true, avatar: true, isAgent: true },
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
      attachments: {
        select: messageAttachmentSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      },
    },
  })

  const formattedMessage = {
    id: message.id,
    channelId: message.channelId,
    userId: message.userId,
    parentId: message.parentId,
    content: message.content,
    embeds: message.embeds,
    attachments: message.attachments.map(toMessageAttachmentResponse),
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    user: message.user,
    mentions: message.mentions.map((mention) => ({
      userId: mention.userId,
      user: mention.user,
    })),
    replyCount: message._count.replies,
  }

  const mentionIds = extractMentionIds(message.content)
  if (mentionIds.length > 0) {
    const mentionedAgents = await prisma.user.findMany({
      where: {
        id: { in: mentionIds },
        isAgent: true,
      },
      select: {
        id: true,
        name: true,
        agentProvider: true,
      },
    })

    for (const agent of mentionedAgents) {
      broadcast({
        type: 'agent_channel_mention',
        workspaceId: channel.workspaceId,
        channelId,
        messageId: message.id,
        agent: {
          id: agent.id,
          name: agent.name ?? 'Agent',
          provider: agent.agentProvider,
        },
        author: {
          id: user.id,
          name: user.name ?? user.email,
        },
        content: message.content.slice(0, 200),
        threadId: body.parentId || null,
        timestamp: new Date().toISOString(),
      })
    }
  }

  // Broadcast to WebSocket clients
  broadcastNewMessage(channelId, formattedMessage, user.id)

  return formattedMessage
})
