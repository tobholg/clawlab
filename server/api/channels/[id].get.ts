import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

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
    messages: channel.messages.reverse().map((msg) => ({
      id: msg.id,
      channelId: msg.channelId,
      userId: msg.userId,
      parentId: msg.parentId,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
      updatedAt: msg.updatedAt.toISOString(),
      editedAt: msg.editedAt?.toISOString() ?? null,
      user: msg.user,
      replyCount: msg._count.replies,
    })),
  }
})
