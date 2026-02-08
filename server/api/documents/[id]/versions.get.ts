import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Document ID is required' })
  }

  const docForAuth = await prisma.document.findUnique({
    where: { id },
    select: { itemId: true },
  })
  if (!docForAuth) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }
  await requireWorkspaceMemberForItem(event, docForAuth.itemId)

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: true },
  })

  return versions.map((version) => ({
    id: version.id,
    documentId: version.documentId,
    title: version.title,
    content: version.content,
    label: version.label,
    notes: version.notes,
    type: version.type.toLowerCase(),
    createdAt: version.createdAt.toISOString(),
    createdBy: version.createdBy ? {
      id: version.createdBy.id,
      name: version.createdBy.name ?? version.createdBy.email.split('@')[0],
      avatar: version.createdBy.avatar,
    } : null,
  }))
})
