import { prisma } from '../../../../utils/prisma'
import { requireWorkspaceMember, requireMinRole } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const targetUserId = getRouterParam(event, 'userId')

  if (!workspaceId || !targetUserId) {
    throw createError({ statusCode: 400, message: 'Workspace ID and User ID are required' })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)
  requireMinRole(auth, 'ADMIN')
  const currentUser = auth.user

  // Cannot remove yourself
  if (targetUserId === currentUser.id) {
    throw createError({ statusCode: 400, message: 'Cannot remove yourself' })
  }

  const targetMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } }
  })

  if (!targetMembership) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  // Cannot remove the OWNER
  if (targetMembership.role === 'OWNER') {
    throw createError({ statusCode: 403, message: 'Cannot remove the workspace owner' })
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true },
  })

  // Find the user's seat before removing
  const seat = await prisma.seat.findFirst({
    where: { organizationId: workspace.organizationId, userId: targetUserId, status: 'OCCUPIED' },
  })

  await prisma.workspaceMember.delete({
    where: { id: targetMembership.id }
  })

  return { success: true, seatId: seat?.id ?? null }
})
