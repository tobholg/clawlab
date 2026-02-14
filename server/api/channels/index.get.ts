import { prisma } from '../../utils/prisma'
import { requireWorkspaceMember } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  const { user } = await requireWorkspaceMember(event, workspaceId)

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
      readStates: {
        where: { userId: user.id },
        select: { lastSeenAt: true },
        take: 1,
      },
    },
    orderBy: [
      { type: 'asc' }, // WORKSPACE channels first
      { name: 'asc' },
    ],
  })

  // Batch check for unseen messages per channel
  const channelIds = channels.map(c => c.id)
  const lastMessagePerChannel = channelIds.length
    ? await prisma.message.groupBy({
        by: ['channelId'],
        where: { channelId: { in: channelIds }, deleted: false, parentId: null },
        _max: { createdAt: true },
      })
    : []
  const lastMessageMap = new Map(lastMessagePerChannel.map(m => [m.channelId, m._max.createdAt]))

  return channels.map((channel) => {
    const lastSeenAt = channel.readStates[0]?.lastSeenAt
    const lastMessageAt = lastMessageMap.get(channel.id)
    const hasUnread = !!(lastMessageAt && (!lastSeenAt || lastMessageAt > lastSeenAt))

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
      memberCount: channel._count.members,
      messageCount: channel._count.messages,
      hasUnread,
      parent: channel.parent,
      project: channel.project
        ? { id: channel.project.id, title: channel.project.title }
        : null,
    }
  })
})
