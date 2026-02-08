import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const seatId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { action, workspaceId } = body

  if (!seatId) {
    throw createError({ statusCode: 400, message: 'Seat ID is required' })
  }

  if (!action || !['free_up', 'remove'].includes(action)) {
    throw createError({ statusCode: 400, message: 'action must be "free_up" or "remove"' })
  }

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  // Require OWNER role
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!membership || membership.status !== 'ACTIVE' || membership.role !== 'OWNER') {
    throw createError({ statusCode: 403, message: 'Only the workspace owner can manage seats' })
  }

  const seat = await prisma.seat.findUnique({ where: { id: seatId } })
  if (!seat) {
    throw createError({ statusCode: 404, message: 'Seat not found' })
  }

  // Verify seat belongs to same organization
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true },
  })
  if (seat.organizationId !== workspace.organizationId) {
    throw createError({ statusCode: 403, message: 'Seat does not belong to this organization' })
  }

  if (action === 'free_up') {
    // Set seat back to AVAILABLE (keep the seat row)
    await prisma.seat.update({
      where: { id: seatId },
      data: { status: 'AVAILABLE', userId: null, occupiedAt: null },
    })
    return { ok: true, action: 'free_up', seatId }
  }

  if (action === 'remove') {
    // Delete the seat row entirely (removes from billing)
    await prisma.seat.delete({ where: { id: seatId } })
    return { ok: true, action: 'remove', seatId }
  }
})
