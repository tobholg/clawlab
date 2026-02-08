import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForChannel } from '../../../utils/auth'

interface AddMemberBody {
  userId: string
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST'
  isExternal?: boolean
}

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')
  const body = await readBody<AddMemberBody>(event)

  if (!channelId) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  if (!body.userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  await requireWorkspaceMemberForChannel(event, channelId)

  // Verify channel exists
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  })

  if (!channel) {
    throw createError({ statusCode: 404, message: 'Channel not found' })
  }

  // Verify user exists
  const user = await prisma.user.findUnique({
    where: { id: body.userId },
  })

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // Check if already a member
  const existing = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: { channelId, userId: body.userId },
    },
  })

  if (existing) {
    throw createError({ statusCode: 400, message: 'User is already a member' })
  }

  const member = await prisma.channelMember.create({
    data: {
      channelId,
      userId: body.userId,
      role: body.role || 'MEMBER',
      isExternal: body.isExternal || false,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
  })

  return {
    id: member.id,
    channelId: member.channelId,
    userId: member.userId,
    role: member.role.toLowerCase(),
    isExternal: member.isExternal,
    muted: member.muted,
    joinedAt: member.joinedAt.toISOString(),
    user: member.user,
  }
})
