import { prisma } from '../../../../utils/prisma'
import { requireWorkspaceMemberForChannel } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')
  const userId = getRouterParam(event, 'userId')

  if (!channelId || !userId) {
    throw createError({ statusCode: 400, message: 'Channel ID and User ID are required' })
  }

  const auth = await requireWorkspaceMemberForChannel(event, channelId)

  // Allow self-removal or workspace admin
  if (userId !== auth.user.id && !auth.isWorkspaceAdmin) {
    // Check if caller is channel admin
    const callerMember = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: auth.user.id } },
      select: { role: true },
    })
    if (!callerMember || (callerMember.role !== 'OWNER' && callerMember.role !== 'ADMIN')) {
      throw createError({ statusCode: 403, statusMessage: 'Only channel admins can remove other members' })
    }
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
