import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/auth'
import { expireStaleInvites } from '../../../utils/seats'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const workspaceId = getQuery(event).workspaceId as string

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

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true },
  })

  // Expire stale invites
  await expireStaleInvites(workspace.organizationId)

  const invites = await prisma.seatInvite.findMany({
    where: {
      organizationId: workspace.organizationId,
      status: 'PENDING',
    },
    include: {
      invitedBy: { select: { id: true, name: true, email: true } },
      workspace: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return invites.map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    status: inv.status,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    invitedBy: inv.invitedBy,
    workspace: inv.workspace,
  }))
})
