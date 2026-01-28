import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  const channels = await prisma.channel.findMany({
    where: {
      workspaceId,
      archived: false,
    },
    include: {
      _count: {
        select: { members: true, messages: true },
      },
      parent: {
        select: { id: true, name: true, displayName: true },
      },
      project: {
        select: { id: true, title: true },
      },
    },
    orderBy: [
      { type: 'asc' }, // WORKSPACE channels first
      { name: 'asc' },
    ],
  })

  return channels.map((channel) => ({
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
    memberCount: channel._count.members,
    messageCount: channel._count.messages,
    unreadCount: 0, // TODO: implement read tracking
    parent: channel.parent,
    project: channel.project
      ? { id: channel.project.id, title: channel.project.title }
      : null,
  }))
})
