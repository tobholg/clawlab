import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const inviteId = getRouterParam(event, 'id')
  const workspaceId = getQuery(event).workspaceId as string

  if (!inviteId) {
    throw createError({ statusCode: 400, message: 'Invite ID is required' })
  }

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  // Require OWNER or ADMIN role
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!membership || membership.status !== 'ACTIVE' || !['OWNER', 'ADMIN'].includes(membership.role)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const invite = await prisma.seatInvite.findUnique({
    where: { id: inviteId },
    select: { id: true, seatId: true, status: true, organizationId: true },
  })

  if (!invite) {
    throw createError({ statusCode: 404, message: 'Invite not found' })
  }

  // Verify same org
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true },
  })
  if (invite.organizationId !== workspace.organizationId) {
    throw createError({ statusCode: 403, message: 'Invite does not belong to this organization' })
  }

  if (invite.status !== 'PENDING') {
    throw createError({ statusCode: 400, message: 'Can only cancel pending invites' })
  }

  // Cancel invite and free up seat
  await prisma.$transaction([
    prisma.seatInvite.update({
      where: { id: inviteId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    }),
    prisma.seat.update({
      where: { id: invite.seatId },
      data: { status: 'AVAILABLE', userId: null },
    }),
  ])

  return { ok: true }
})
