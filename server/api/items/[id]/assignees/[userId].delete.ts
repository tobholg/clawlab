import { prisma } from '../../../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../../../utils/auth'
import { requireItemPermission } from '../../../../utils/permissions'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const userId = getRouterParam(event, 'userId')

  if (!id || !userId) {
    throw createError({ statusCode: 400, message: 'Item ID and User ID are required' })
  }

  const auth = await requireWorkspaceMemberForItem(event, id)
  await requireItemPermission(auth, id, 'assign')
  
  // Find and delete the assignment
  const assignment = await prisma.itemAssignment.findUnique({
    where: {
      itemId_userId: { itemId: id, userId }
    }
  })
  
  if (!assignment) {
    throw createError({ statusCode: 404, message: 'Assignment not found' })
  }
  
  // Get item's projectId before deleting
  const item = await prisma.item.findUnique({
    where: { id },
    select: { projectId: true },
  })

  await prisma.itemAssignment.delete({
    where: { id: assignment.id }
  })

  // Update item's lastActivityAt
  await prisma.item.update({
    where: { id },
    data: { lastActivityAt: new Date() }
  })

  // Remove from project channel if no longer assigned to any items in the project
  const projectId = item?.projectId ?? id
  const projectChannel = await prisma.channel.findFirst({
    where: { projectId },
    select: { id: true },
  })
  if (projectChannel) {
    // Check if user is still assigned to any other item in this project
    const otherAssignments = await prisma.itemAssignment.findFirst({
      where: {
        userId: userId!,
        item: { OR: [{ id: projectId }, { projectId }] },
      },
    })
    if (!otherAssignments) {
      await prisma.channelMember.deleteMany({
        where: { channelId: projectChannel.id, userId: userId!, role: 'MEMBER' },
      })
    }
  }

  return { deleted: true, userId }
})
