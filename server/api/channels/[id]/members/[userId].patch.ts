import { prisma } from '../../../../utils/prisma'
import { requireWorkspaceMemberForChannel } from '../../../../utils/auth'

interface UpdateMemberBody {
  role?: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST'
}

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')
  const userId = getRouterParam(event, 'userId')
  const body = await readBody<UpdateMemberBody>(event)

  if (!channelId || !userId) {
    throw createError({ statusCode: 400, message: 'Channel ID and User ID are required' })
  }

  const auth = await requireWorkspaceMemberForChannel(event, channelId)

  // Require channel OWNER or workspace ADMIN
  if (!auth.isWorkspaceAdmin) {
    const callerMember = await prisma.channelMember.findUnique({
      where: { channelId_userId: { channelId, userId: auth.user.id } },
      select: { role: true },
    })
    if (!callerMember || callerMember.role !== 'OWNER') {
      throw createError({ statusCode: 403, statusMessage: 'Only channel owner can change member roles' })
    }
  }

  const member = await prisma.channelMember.findUnique({
    where: { channelId_userId: { channelId, userId } },
  })

  if (!member) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  const updateData: Record<string, unknown> = {}
  if (body.role) {
    updateData.role = body.role
  }

  const updated = await prisma.channelMember.update({
    where: { id: member.id },
    data: updateData,
    include: {
      user: {
        select: { id: true, name: true, email: true, avatar: true },
      },
    },
  })

  return {
    id: updated.id,
    channelId: updated.channelId,
    userId: updated.userId,
    role: updated.role.toLowerCase(),
    isExternal: updated.isExternal,
    muted: updated.muted,
    joinedAt: updated.joinedAt.toISOString(),
    user: updated.user,
  }
})
