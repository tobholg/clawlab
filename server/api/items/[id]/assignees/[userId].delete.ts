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
  
  await prisma.itemAssignment.delete({
    where: { id: assignment.id }
  })
  
  // Update item's lastActivityAt
  await prisma.item.update({
    where: { id },
    data: { lastActivityAt: new Date() }
  })
  
  return { deleted: true, userId }
})
