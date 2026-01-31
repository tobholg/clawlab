import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Document ID is required' })
  }

  const document = await prisma.document.findUnique({
    where: { id },
    include: {
      createdBy: true,
      lastEditedBy: true,
      _count: { select: { versions: true } },
    },
  })

  if (!document) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  return {
    id: document.id,
    itemId: document.itemId,
    projectId: document.projectId,
    title: document.title,
    content: document.content,
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
