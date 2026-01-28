import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')
  const userId = getRouterParam(event, 'userId')

  if (!channelId || !userId) {
    throw createError({ statusCode: 400, message: 'Channel ID and User ID are required' })
  }

  // Find the membership
  const member = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: { channelId, userId },
    },
  })

  if (!member) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  // Don't allow removing the last owner
  if (member.role === 'OWNER') {
    const ownerCount = await prisma.channelMember.count({
      where: { channelId, role: 'OWNER' },
    })
    if (ownerCount <= 1) {
      throw createError({ statusCode: 400, message: 'Cannot remove the last owner' })
    }
  }

  await prisma.channelMember.delete({
    where: { id: member.id },
  })

  return {
    success: true,
    message: 'Member removed from channel',
  }
})
