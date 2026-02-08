import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'User ID is required' })
  }
  
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      currentFocusItemId: true,
      currentFocusStartedAt: true,
    }
  })
  
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }
  
  return {
    id: user.id,
    name: user.name ?? user.email.split('@')[0],
    email: user.email,
    avatar: user.avatar,
    currentFocusItemId: user.currentFocusItemId,
    currentFocusStartedAt: user.currentFocusStartedAt?.toISOString() ?? null,
  }
})
