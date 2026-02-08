import { prisma } from '../../../../utils/prisma'
import { requireUser } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireUser(event)
  const workspaceId = getRouterParam(event, 'id')
  const targetUserId = getRouterParam(event, 'userId')

  if (!workspaceId || !targetUserId) {
    throw createError({ statusCode: 400, message: 'Workspace ID and User ID are required' })
  }

  // Require OWNER or ADMIN role
  const currentMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: currentUser.id } }
  })

  if (!currentMembership || currentMembership.status !== 'ACTIVE' || !['OWNER', 'ADMIN'].includes(currentMembership.role)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const body = await readBody(event)
  const { role, status } = body

  // Must provide at least one field to update
  if (!role && !status) {
    throw createError({ statusCode: 400, message: 'role or status is required' })
  }

  // Cannot change own role or status
  if (targetUserId === currentUser.id) {
    throw createError({ statusCode: 400, message: 'Cannot change your own role or status' })
  }

  // Validate role if provided
  if (role && !['ADMIN', 'MEMBER', 'VIEWER'].includes(role)) {
    throw createError({ statusCode: 400, message: 'Invalid role' })
  }

  if (role === 'OWNER') {
    throw createError({ statusCode: 400, message: 'Cannot assign OWNER role' })
  }

  // Validate status if provided
  if (status && !['ACTIVE', 'DEACTIVATED'].includes(status)) {
    throw createError({ statusCode: 400, message: 'Invalid status. Must be ACTIVE or DEACTIVATED' })
  }

  const targetMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } }
  })

  if (!targetMembership) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  // Cannot modify the OWNER
  if (targetMembership.role === 'OWNER') {
    throw createError({ statusCode: 403, message: 'Cannot modify the workspace owner' })
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true },
  })

  // When reactivating, check if there's an available seat
  if (status === 'ACTIVE' && targetMembership.status === 'DEACTIVATED') {
    const availableSeat = await prisma.seat.findFirst({
      where: { organizationId: workspace.organizationId, type: 'INTERNAL', status: 'AVAILABLE' },
    })
    if (!availableSeat) {
      throw createError({
        statusCode: 403,
        message: 'No available seats. Purchase more seats or free up existing ones to reactivate this member.',
      })
    }
    // Occupy the seat
    await prisma.seat.update({
      where: { id: availableSeat.id },
      data: { status: 'OCCUPIED', userId: targetUserId, occupiedAt: new Date() },
    })
  }

  const data: Record<string, any> = {}
  if (role) data.role = role
  if (status) data.status = status

  const updated = await prisma.workspaceMember.update({
    where: { id: targetMembership.id },
    data,
    include: { user: { select: { id: true, email: true, name: true } } }
  })

  // On deactivation, find the user's seat to include in response
  let seatId: string | null = null
  if (status === 'DEACTIVATED') {
    const seat = await prisma.seat.findFirst({
      where: { organizationId: workspace.organizationId, userId: targetUserId, status: 'OCCUPIED' },
    })
    seatId = seat?.id ?? null
  }

  return {
    id: updated.id,
    userId: updated.user.id,
    email: updated.user.email,
    name: updated.user.name,
    role: updated.role,
    status: updated.status,
    seatId,
  }
})
