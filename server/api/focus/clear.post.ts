import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId } = body
  
  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }
  
  const now = new Date()
  
  // Get current focus
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentFocusItemId: true }
  })
  
  if (user?.currentFocusItemId) {
    // Close the focus session
    await prisma.focusSession.updateMany({
      where: {
        userId,
        itemId: user.currentFocusItemId,
        endedAt: null,
      },
      data: { endedAt: now }
    })
  }
  
  // Clear user's current focus
  await prisma.user.update({
    where: { id: userId },
    data: {
      currentFocusItemId: null,
      currentFocusStartedAt: null,
    }
  })
  
  return { cleared: true }
})
