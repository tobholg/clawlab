import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, itemId } = body
  
  if (!userId || !itemId) {
    throw createError({ statusCode: 400, message: 'userId and itemId are required' })
  }
  
  const now = new Date()
  
  // Ensure user exists (create demo user if needed)
  let user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, currentFocusItemId: true, currentFocusStartedAt: true }
  })
  
  if (!user) {
    // Create demo user
    user = await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@demo.local`,
        name: 'Demo User',
      },
      select: { id: true, currentFocusItemId: true, currentFocusStartedAt: true }
    })
  }
  
  if (user.currentFocusItemId) {
    // Close the previous focus session
    await prisma.focusSession.updateMany({
      where: {
        userId,
        itemId: user.currentFocusItemId,
        endedAt: null,
      },
      data: { endedAt: now }
    })
  }
  
  // Create new focus session
  const session = await prisma.focusSession.create({
    data: {
      userId,
      itemId,
      startedAt: now,
    }
  })
  
  // Update user's current focus
  await prisma.user.update({
    where: { id: userId },
    data: {
      currentFocusItemId: itemId,
      currentFocusStartedAt: now,
    }
  })
  
  return {
    sessionId: session.id,
    itemId,
    startedAt: now.toISOString(),
  }
})
