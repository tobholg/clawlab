import { prisma } from '../utils/prisma'
import { requireUser } from '../utils/auth'
import { iContains } from '../utils/db-compat'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const q = (query.q as string || '').trim()
  const workspaceId = query.workspaceId as string

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  if (!q || q.length < 2) {
    return { items: [], channels: [], members: [] }
  }

  // Verify membership
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } }
  })

  if (!membership || membership.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, message: 'Not a workspace member' })
  }

  const searchPattern = `%${q}%`

  // Search items (projects + tasks)
  const items = await prisma.item.findMany({
    where: {
      workspaceId,
      OR: [
        { title: iContains(q) },
        { description: iContains(q) },
      ]
    },
    select: {
      id: true,
      title: true,
      status: true,
      parentId: true,
      projectId: true,
      parent: { select: { title: true } },
    },
    orderBy: { lastActivityAt: 'desc' },
    take: 8,
  })

  // Search channels
  const channels = await prisma.channel.findMany({
    where: {
      workspaceId,
      displayName: iContains(q),
    },
    select: {
      id: true,
      displayName: true,
      type: true,
      visibility: true,
    },
    take: 5,
  })

  // Search members
  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      status: 'ACTIVE',
      user: {
        OR: [
          { name: iContains(q) },
          { email: iContains(q) },
        ]
      }
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } }
    },
    take: 5,
  })

  return {
    items: items.map(item => ({
      id: item.id,
      title: item.title,
      status: item.status,
      isProject: !item.parentId,
      parentTitle: item.parent?.title || null,
      projectId: item.projectId,
    })),
    channels: channels.map(ch => ({
      id: ch.id,
      name: ch.displayName,
      type: ch.type,
      visibility: ch.visibility,
    })),
    members: members.map(m => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      avatar: m.user.avatar,
    })),
  }
})
