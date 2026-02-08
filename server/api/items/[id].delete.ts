import { prisma } from '../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  await requireWorkspaceMemberForItem(event, id)

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      children: { select: { id: true } },
    },
  })

  if (!item) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }

  // Prevent deletion if item has children
  if (item.children.length > 0) {
    throw createError({
      statusCode: 400,
      message: 'Cannot delete item with children. Delete child items first.'
    })
  }

  // Delete related records in order (due to foreign key constraints)
  await prisma.$transaction(async (tx) => {
    // Delete assignees
    await tx.itemAssignment.deleteMany({ where: { itemId: id } })

    // Delete stakeholders
    await tx.itemStakeholder.deleteMany({ where: { itemId: id } })

    // Delete dependencies (both directions)
    await tx.itemDependency.deleteMany({ where: { blockedItemId: id } })
    await tx.itemDependency.deleteMany({ where: { blockingItemId: id } })

    // Delete comments and their replies
    await tx.comment.deleteMany({ where: { itemId: id } })

    // Delete activity records
    await tx.activity.deleteMany({ where: { itemId: id } })

    // Delete documents and their versions
    const documents = await tx.document.findMany({
      where: { itemId: id },
      select: { id: true }
    })
    for (const doc of documents) {
      await tx.documentVersion.deleteMany({ where: { documentId: doc.id } })
    }
    await tx.document.deleteMany({ where: { itemId: id } })

    // Finally delete the item
    await tx.item.delete({ where: { id } })
  })

  return { success: true }
})
