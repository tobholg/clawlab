import { prisma } from '../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../utils/auth'
import { requireItemPermission } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  const auth = await requireWorkspaceMemberForItem(event, id)
  await requireItemPermission(auth, id, 'delete')

  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!item) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }

  // Collect all descendant IDs (breadth-first)
  const allItemIds: string[] = [id]
  let frontier = [id]

  while (frontier.length > 0) {
    const children = await prisma.item.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    })
    const childIds = children.map(c => c.id)
    if (childIds.length === 0) break
    allItemIds.push(...childIds)
    frontier = childIds
  }

  // Delete all related records for all items in a single transaction
  await prisma.$transaction(async (tx) => {
    // Delete assignees
    await tx.itemAssignment.deleteMany({ where: { itemId: { in: allItemIds } } })

    // Delete stakeholders
    await tx.itemStakeholder.deleteMany({ where: { itemId: { in: allItemIds } } })

    // Delete dependencies (both directions)
    await tx.itemDependency.deleteMany({ where: { blockedItemId: { in: allItemIds } } })
    await tx.itemDependency.deleteMany({ where: { blockingItemId: { in: allItemIds } } })

    // Delete comments and their replies
    await tx.comment.deleteMany({ where: { itemId: { in: allItemIds } } })

    // Delete activity records
    await tx.activity.deleteMany({ where: { itemId: { in: allItemIds } } })

    // Delete documents and their versions
    const documents = await tx.document.findMany({
      where: { itemId: { in: allItemIds } },
      select: { id: true },
    })
    if (documents.length > 0) {
      const docIds = documents.map(d => d.id)
      await tx.documentVersion.deleteMany({ where: { documentId: { in: docIds } } })
      await tx.document.deleteMany({ where: { itemId: { in: allItemIds } } })
    }

    // Delete project channels and all their data
    const channels = await tx.channel.findMany({
      where: { projectId: { in: allItemIds } },
      select: { id: true },
    })
    if (channels.length > 0) {
      const channelIds = channels.map(c => c.id)

      // Delete reactions on messages in these channels
      await tx.reaction.deleteMany({
        where: { message: { channelId: { in: channelIds } } },
      })

      // Delete messages
      await tx.message.deleteMany({ where: { channelId: { in: channelIds } } })

      // Delete channel members
      await tx.channelMember.deleteMany({ where: { channelId: { in: channelIds } } })

      // Delete read states
      await tx.channelReadState.deleteMany({ where: { channelId: { in: channelIds } } })

      // Delete channels
      await tx.channel.deleteMany({ where: { id: { in: channelIds } } })
    }

    // Delete items in reverse order (children before parents)
    await tx.item.deleteMany({ where: { id: { in: allItemIds.slice().reverse() } } })
  })

  return { success: true }
})
