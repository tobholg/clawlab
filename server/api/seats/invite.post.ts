import { randomBytes } from 'crypto'
import { prisma } from '../../utils/prisma'
import { requireUser, buildAppBaseUrl } from '../../utils/auth'
import { findAvailableSeat, checkUserAlreadySeated, expireStaleInvites } from '../../utils/seats'

export default defineEventHandler(async (event) => {
  const currentUser = await requireUser(event)
  const body = await readBody(event)
  const { workspaceId, email: rawEmail, role } = body

  if (!workspaceId || !rawEmail) {
    throw createError({ statusCode: 400, message: 'workspaceId and email are required' })
  }

  const email = rawEmail.toLowerCase().trim()
  const inviteRole = role || 'MEMBER'

  if (!['ADMIN', 'MEMBER', 'VIEWER'].includes(inviteRole)) {
    throw createError({ statusCode: 400, message: 'Invalid role' })
  }

  // Require OWNER or ADMIN role
  const currentMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: currentUser.id } },
  })
  if (!currentMembership || currentMembership.status !== 'ACTIVE' || !['OWNER', 'ADMIN'].includes(currentMembership.role)) {
    throw createError({ statusCode: 403, message: 'Admin access required' })
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { id: true, name: true, organizationId: true },
  })

  // Expire stale invites first
  await expireStaleInvites(workspace.organizationId)

  // Check no duplicate pending invite for this email in this org
  const existingInvite = await prisma.seatInvite.findFirst({
    where: {
      organizationId: workspace.organizationId,
      email,
      status: 'PENDING',
    },
  })
  if (existingInvite) {
    throw createError({ statusCode: 409, message: 'A pending invite already exists for this email' })
  }

  // Check if user already exists and is active in this workspace
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    const existingWsMember = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
    })
    if (existingWsMember && existingWsMember.status === 'ACTIVE') {
      throw createError({ statusCode: 409, message: 'User is already an active workspace member' })
    }
  }

  // Check if user is already seated in the org (cross-workspace)
  // If so, they don't need a new seat — we'll still create the invite but skip seat consumption
  const alreadySeated = existingUser
    ? await checkUserAlreadySeated(workspace.organizationId, existingUser.id)
    : false

  let seatId: string

  if (alreadySeated) {
    // User already has a seat — create a "virtual" invite without consuming a seat
    // We create a temporary AVAILABLE seat just for the invite tracking, which will be
    // freed when accepted (since user already has their real seat)
    // Actually simpler: just find their existing occupied seat
    const existingSeat = await prisma.seat.findFirst({
      where: { organizationId: workspace.organizationId, userId: existingUser!.id, status: 'OCCUPIED' },
    })
    if (!existingSeat) {
      throw createError({ statusCode: 500, message: 'User seated but no occupied seat found' })
    }
    // For cross-workspace invites, we don't consume a new seat.
    // Create the invite without a seat link — use a placeholder approach:
    // Actually, we need a seatId for SeatInvite. Let's create a temporary seat that
    // will be removed on accept. Better approach: find available seat, or if none,
    // just create the workspace member directly since they already have a seat.

    // Simplest approach: if user is already seated, add them to workspace directly
    const token = randomBytes(32).toString('hex')

    // Create workspace member directly (they already have an org seat)
    if (existingUser) {
      const existingWsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      })

      if (existingWsMember && existingWsMember.status === 'DEACTIVATED') {
        // Reactivate
        await prisma.workspaceMember.update({
          where: { id: existingWsMember.id },
          data: { status: 'ACTIVE', role: inviteRole },
        })
      } else if (!existingWsMember) {
        await prisma.workspaceMember.create({
          data: { workspaceId, userId: existingUser.id, role: inviteRole },
        })
      }
    }

    return {
      directAdd: true,
      message: 'User already has a seat in this organization and was added to the workspace directly',
    }
  }

  // Find an available INTERNAL seat
  const availableSeat = await findAvailableSeat(workspace.organizationId, 'INTERNAL')
  if (!availableSeat) {
    throw createError({
      statusCode: 403,
      message: 'No available seats. Purchase more seats to invite new members.',
    })
  }

  // Generate unique invite token
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  // Transaction: mark seat as INVITED + create SeatInvite
  const invite = await prisma.$transaction(async (tx) => {
    await tx.seat.update({
      where: { id: availableSeat.id },
      data: { status: 'INVITED' },
    })

    return tx.seatInvite.create({
      data: {
        seatId: availableSeat.id,
        organizationId: workspace.organizationId,
        email,
        role: inviteRole,
        workspaceId,
        invitedById: currentUser.id,
        token,
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        token: true,
        workspace: { select: { id: true, name: true } },
      },
    })
  })

  const baseUrl = buildAppBaseUrl(event)
  const inviteLink = `${baseUrl}/invite/accept?token=${invite.token}`

  return {
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expiresAt.toISOString(),
      workspace: invite.workspace,
    },
    inviteLink,
  }
})
