import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const token = getQuery(event).token as string

  if (!token) {
    throw createError({ statusCode: 400, message: 'token is required' })
  }

  const invite = await prisma.seatInvite.findUnique({
    where: { token },
    include: {
      organization: { select: { id: true, name: true } },
      workspace: { select: { id: true, name: true, slug: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  })

  if (!invite) {
    throw createError({ statusCode: 404, message: 'Invite not found' })
  }

  if (invite.status !== 'PENDING') {
    return {
      valid: false,
      status: invite.status,
      message: invite.status === 'ACCEPTED'
        ? 'This invite has already been accepted'
        : invite.status === 'EXPIRED'
          ? 'This invite has expired'
          : 'This invite has been cancelled',
    }
  }

  if (invite.expiresAt < new Date()) {
    // Mark as expired
    await prisma.$transaction([
      prisma.seatInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      }),
      prisma.seat.update({
        where: { id: invite.seatId },
        data: { status: 'AVAILABLE', userId: null },
      }),
    ])

    return {
      valid: false,
      status: 'EXPIRED',
      message: 'This invite has expired',
    }
  }

  return {
    valid: true,
    email: invite.email,
    role: invite.role,
    organization: invite.organization,
    workspace: invite.workspace,
    invitedBy: invite.invitedBy,
    expiresAt: invite.expiresAt.toISOString(),
  }
})
