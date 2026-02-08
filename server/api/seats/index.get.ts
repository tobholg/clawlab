import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { expireStaleInvites } from '../../utils/seats'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const workspaceId = getQuery(event).workspaceId as string

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  // Verify membership
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!membership || membership.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, message: 'Not a workspace member' })
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true },
  })

  // Lazily expire stale invites
  await expireStaleInvites(workspace.organizationId)

  const seats = await prisma.seat.findMany({
    where: { organizationId: workspace.organizationId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      invite: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          expiresAt: true,
          workspace: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: [{ type: 'asc' }, { status: 'asc' }, { createdAt: 'asc' }],
  })

  // Summary counts
  const summary = {
    internal: { total: 0, available: 0, invited: 0, occupied: 0 },
    external: { total: 0, available: 0, invited: 0, occupied: 0 },
  }

  for (const seat of seats) {
    const bucket = seat.type === 'INTERNAL' ? summary.internal : summary.external
    bucket.total++
    if (seat.status === 'AVAILABLE') bucket.available++
    else if (seat.status === 'INVITED') bucket.invited++
    else if (seat.status === 'OCCUPIED') bucket.occupied++
  }

  return { seats, summary }
})
