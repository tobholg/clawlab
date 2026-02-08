import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  const { userId } = body

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  const { user: authUser } = await requireWorkspaceMemberForItem(event, id)

  // Verify item exists
  const item = await prisma.item.findUnique({ where: { id } })
  if (!item) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({ where: { id: userId } })
  if (!targetUser) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // Check if already assigned
  const existing = await prisma.itemAssignment.findUnique({
    where: {
      itemId_userId: { itemId: id, userId }
    }
  })

  if (existing) {
    return { message: 'Already assigned', assignmentId: existing.id }
  }

  // Create assignment
  const assignment = await prisma.itemAssignment.create({
    data: {
      itemId: id,
      userId,
    },
    include: { user: true }
  })

  // Update item's lastActivityAt
  await prisma.item.update({
    where: { id },
    data: { lastActivityAt: new Date() }
  })

  // Create activity log
  await prisma.activity.create({
    data: {
      itemId: id,
      userId: authUser.id,
      type: 'ASSIGNMENT',
      newValue: userId,
    }
  })

  return {
    id: assignment.id,
    userId: assignment.userId,
    user: {
      id: assignment.user.id,
      name: assignment.user.name ?? assignment.user.email.split('@')[0],
      avatar: assignment.user.avatar,
    }
  }
})
