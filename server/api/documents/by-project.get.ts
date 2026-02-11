import { prisma } from '../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const projectId = query.projectId as string | undefined
  const itemId = query.itemId as string | undefined
  const targetId = projectId || itemId

  if (!targetId) {
    throw createError({ statusCode: 400, message: 'projectId or itemId is required' })
  }

  await requireWorkspaceMemberForItem(event, targetId)

  // For root projects: query by denormalized projectId field (covers entire tree)
  // For non-root items: query docs on the item itself + docs on direct children
  const whereClause = projectId
    ? { OR: [{ projectId }, { itemId: projectId }] }
    : { OR: [{ itemId: targetId }, { item: { parentId: targetId } }] }

  const documents = await prisma.document.findMany({
    where: whereClause,
    include: {
      item: { select: { id: true, title: true, parentId: true } },
      createdBy: true,
      lastEditedBy: true,
      _count: { select: { versions: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const ownDocs: any[] = []
  const childDocsMap: Record<string, { itemId: string; itemTitle: string; docs: any[] }> = {}

  for (const doc of documents) {
    const formatted = {
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
    }

    if (doc.itemId === targetId) {
      ownDocs.push(formatted)
    } else {
      const docItemId = doc.item.id
      if (!childDocsMap[docItemId]) {
        childDocsMap[docItemId] = {
          itemId: docItemId,
          itemTitle: doc.item.title,
          docs: [],
        }
      }
      childDocsMap[docItemId].docs.push(formatted)
    }
  }

  return {
    projectDocs: ownDocs,
    taskDocs: Object.values(childDocsMap),
  }
})
