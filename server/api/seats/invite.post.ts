import { randomBytes } from 'crypto'
import { prisma } from '../../utils/prisma'
import { requireUser, buildAppBaseUrl } from '../../utils/auth'
import { findAvailableSeat, checkUserAlreadySeated, expireStaleInvites } from '../../utils/seats'
import { generateVerificationCode, sendInviteEmail } from '../../utils/email'

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
  const alreadySeated = existingUser
    ? await checkUserAlreadySeated(workspace.organizationId, existingUser.id)
    : false

  if (alreadySeated) {
    // User already has a seat — add them to workspace directly
    if (existingUser) {
      const existingWsMember = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
      })

      if (existingWsMember && existingWsMember.status === 'DEACTIVATED') {
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

  // Generate unique invite token + verification code
  const token = randomBytes(32).toString('hex')
  const code = generateVerificationCode()
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days

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
        code,
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

  // Get org name for the email
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: workspace.organizationId },
    select: { name: true },
  })

  // Send invite email
  try {
    await sendInviteEmail({
      to: email,
      inviterName: currentUser.name || currentUser.email,
      organizationName: org.name,
      workspaceName: workspace.name,
      role: inviteRole,
      inviteLink,
      code,
    })
  } catch (e) {
    console.error('[invite] Failed to send invite email:', e)
    if (process.env.NODE_ENV === 'development') {
      console.info(`[invite] Invite link for ${email}: ${inviteLink}`)
      console.info(`[invite] Verification code: ${code}`)
    }
  }

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
