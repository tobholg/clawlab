import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { itemId, title, content, userId } = body

  if (!itemId) {
    throw createError({ statusCode: 400, message: 'itemId is required' })
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, projectId: true, workspaceId: true },
  })

  if (!item) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }

  let creatorId = userId as string | undefined
  if (creatorId) {
    const user = await prisma.user.findUnique({ where: { id: creatorId }, select: { id: true } })
    if (!user) creatorId = undefined
  }

  if (!creatorId) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId: item.workspaceId },
      select: { userId: true },
    })
    creatorId = member?.userId
  }

  if (!creatorId) {
    throw createError({ statusCode: 400, message: 'creator userId is required' })
  }

  const document = await prisma.document.create({
    data: {
      itemId,
      projectId: item.projectId ?? item.id,
      title: (title ?? 'Untitled document').toString(),
      content: content?.toString() ?? '',
      createdById: creatorId,
      lastEditedById: creatorId,
    },
    include: {
      createdBy: true,
      lastEditedBy: true,
      _count: { select: { versions: true } },
    },
  })

  return {
    id: document.id,
    itemId: document.itemId,
    projectId: document.projectId,
    title: document.title,
    isLocked: document.isLocked,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    createdBy: document.createdBy ? {
      id: document.createdBy.id,
      name: document.createdBy.name ?? document.createdBy.email.split('@')[0],
      avatar: document.createdBy.avatar,
    } : null,
    lastEditedBy: document.lastEditedBy ? {
      id: document.lastEditedBy.id,
      name: document.lastEditedBy.name ?? document.lastEditedBy.email.split('@')[0],
      avatar: document.lastEditedBy.avatar,
    } : null,
    versionCount: document._count.versions,
  }
})
