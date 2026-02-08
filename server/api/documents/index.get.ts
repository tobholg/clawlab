import { prisma } from '../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const itemId = query.itemId as string | undefined

  if (!itemId) {
    throw createError({ statusCode: 400, message: 'itemId is required' })
  }

  await requireWorkspaceMemberForItem(event, itemId)

  const documents = await prisma.document.findMany({
    where: { itemId },
    orderBy: { updatedAt: 'desc' },
    include: {
      createdBy: true,
      lastEditedBy: true,
      _count: { select: { versions: true } },
    },
  })

  return documents.map((doc) => ({
    id: doc.id,
    itemId: doc.itemId,
    projectId: doc.projectId,
    title: doc.title,
    isLocked: doc.isLocked,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    createdBy: doc.createdBy ? {
      id: doc.createdBy.id,
      name: doc.createdBy.name ?? doc.createdBy.email.split('@')[0],
      avatar: doc.createdBy.avatar,
    } : null,
    lastEditedBy: doc.lastEditedBy ? {
      id: doc.lastEditedBy.id,
      name: doc.lastEditedBy.name ?? doc.lastEditedBy.email.split('@')[0],
      avatar: doc.lastEditedBy.avatar,
    } : null,
    versionCount: doc._count.versions,
  }))
})
