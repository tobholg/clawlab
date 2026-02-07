import { prisma } from '../../utils/prisma'
import { getSessionUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const sessionUser = await getSessionUser(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  const channel = await prisma.channel.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      messages: {
        where: { deleted: false, parentId: null }, // Only top-level messages
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
        take: 50,
      },
      parent: {
        select: { id: true, name: true, displayName: true },
      },
      children: {
        where: { archived: false },
        select: { id: true, name: true, displayName: true, type: true },
      },
      project: {
        select: { id: true, title: true, status: true },
      },
    },
  })

  if (!channel) {
    throw createError({ statusCode: 404, message: 'Channel not found' })
  }

  const chronologicalMessages = [...channel.messages].reverse()
  let readStatePayload: {
    lastSeenAt: string | null
    missedCount: number
    missedBoundaryMessageId: string | null
  } = {
    lastSeenAt: null,
    missedCount: 0,
    missedBoundaryMessageId: null,
  }

  if (sessionUser) {
    let readState = await prisma.channelReadState.findUnique({
      where: {
        channelId_userId: {
          channelId: channel.id,
          userId: sessionUser.id,
        },
      },
    })

    if (!readState) {
      const initialLastSeenAt = channel.messages[0]?.createdAt ?? new Date()
      readState = await prisma.channelReadState.upsert({
        where: {
          channelId_userId: {
            channelId: channel.id,
            userId: sessionUser.id,
          },
        },
        update: {},
        create: {
          channelId: channel.id,
          userId: sessionUser.id,
          lastSeenAt: initialLastSeenAt,
        },
      })
    }

    const missedCount = await prisma.message.count({
      where: {
        channelId: channel.id,
        deleted: false,
        parentId: null,
        createdAt: { gt: readState.lastSeenAt },
      },
    })

    const missedBoundaryMessageId =
      chronologicalMessages.find((msg) => msg.createdAt > readState.lastSeenAt)?.id ?? null

    readStatePayload = {
      lastSeenAt: readState.lastSeenAt.toISOString(),
      missedCount,
      missedBoundaryMessageId,
    }
  }

  return {
    id: channel.id,
    workspaceId: channel.workspaceId,
    parentId: channel.parentId,
    projectId: channel.projectId,
    name: channel.name,
    displayName: channel.displayName ?? channel.name,
    description: channel.description,
    type: channel.type.toLowerCase(),
    visibility: channel.visibility.toLowerCase(),
    inheritMembers: channel.inheritMembers,
    archived: channel.archived,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
    parent: channel.parent,
    children: channel.children.map((c) => ({
      id: c.id,
      name: c.name,
      displayName: c.displayName ?? c.name,
      type: c.type.toLowerCase(),
    })),
    project: channel.project
      ? {
          id: channel.project.id,
          title: channel.project.title,
          status: channel.project.status.toLowerCase(),
        }
      : null,
    members: channel.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role.toLowerCase(),
      isExternal: m.isExternal,
      muted: m.muted,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    })),
    messages: chronologicalMessages.map((msg) => ({
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
      reactions: groupReactions(msg.reactions),
    })),
    readState: readStatePayload,
  }
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
