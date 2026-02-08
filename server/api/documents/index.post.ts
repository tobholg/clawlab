import { prisma } from '../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../utils/auth'

const MAX_TITLE_LENGTH = 255
const MAX_DOCUMENTS_PER_ITEM = 25

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { itemId, title, content } = body

  if (!itemId) {
    throw createError({ statusCode: 400, message: 'itemId is required' })
  }

  const { user } = await requireWorkspaceMemberForItem(event, itemId)

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, projectId: true, workspaceId: true },
  })

  if (!item) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }

  const docTitle = (title ?? 'Untitled document').toString()
  if (docTitle.length > MAX_TITLE_LENGTH) {
    throw createError({ statusCode: 400, message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` })
  }

  // Enforce document limit per item
  const existingCount = await prisma.document.count({ where: { itemId } })
  if (existingCount >= MAX_DOCUMENTS_PER_ITEM) {
    throw createError({
      statusCode: 403,
      message: `Maximum of ${MAX_DOCUMENTS_PER_ITEM} documents per item reached.`,
    })
  }

  const document = await prisma.document.create({
    data: {
      itemId,
      projectId: item.projectId ?? item.id,
      title: docTitle,
      content: content?.toString() ?? '',
      createdById: user.id,
      lastEditedById: user.id,
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
