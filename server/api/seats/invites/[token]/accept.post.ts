import { prisma } from '../../../../utils/prisma'
import { requireUser } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const currentUser = await requireUser(event)
  const token = getRouterParam(event, 'token')
  const body = await readBody<{ code?: string }>(event)
  const code = body.code?.toUpperCase().trim()

  if (!token) {
    throw createError({ statusCode: 400, message: 'Token is required' })
  }

  if (!code || code.length !== 4) {
    throw createError({ statusCode: 400, message: 'A 4-character verification code is required' })
  }

  const invite = await prisma.seatInvite.findUnique({
    where: { token },
    include: {
      seat: true,
      workspace: { select: { id: true, name: true, slug: true, organizationId: true } },
      organization: { select: { id: true, name: true } },
    },
  })

  if (!invite) {
    throw createError({ statusCode: 404, message: 'Invite not found' })
  }

  if (invite.status !== 'PENDING') {
    throw createError({ statusCode: 400, message: `Invite is ${invite.status.toLowerCase()}, not pending` })
  }

  if (invite.expiresAt < new Date()) {
    // Mark expired
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
    throw createError({ statusCode: 400, message: 'This invite has expired' })
  }

  // Email must match
  const userEmail = currentUser.email.toLowerCase()
  if (userEmail !== invite.email.toLowerCase()) {
    throw createError({
      statusCode: 403,
      message: `This invite was sent to ${invite.email}. You are logged in as ${currentUser.email}.`,
    })
  }

  // Verification code must match
  if (invite.code !== code) {
    throw createError({ statusCode: 400, message: 'Invalid verification code' })
  }

  // Accept: transaction to update invite, seat, create members
  const result = await prisma.$transaction(async (tx) => {
    // 1. Mark invite as accepted
    await tx.seatInvite.update({
      where: { id: invite.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    })

    // 2. Mark seat as occupied
    await tx.seat.update({
      where: { id: invite.seatId },
      data: {
        status: 'OCCUPIED',
        userId: currentUser.id,
        occupiedAt: new Date(),
      },
    })

    // 3. Create or reactivate workspace member
    const existingWsMember = await tx.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: currentUser.id } },
    })

    if (existingWsMember) {
      if (existingWsMember.status === 'DEACTIVATED') {
        await tx.workspaceMember.update({
          where: { id: existingWsMember.id },
          data: { status: 'ACTIVE', role: invite.role },
        })
      }
    } else {
      await tx.workspaceMember.create({
        data: {
          workspaceId: invite.workspaceId,
          userId: currentUser.id,
          role: invite.role,
        },
      })
    }

    // 4. Create org member if not exists
    const existingOrgMember = await tx.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: currentUser.id,
        },
      },
    })

    if (!existingOrgMember) {
      await tx.organizationMember.create({
        data: {
          organizationId: invite.organizationId,
          userId: currentUser.id,
          role: 'MEMBER',
        },
      })
    } else if (existingOrgMember.status === 'DEACTIVATED') {
      await tx.organizationMember.update({
        where: { id: existingOrgMember.id },
        data: { status: 'ACTIVE' },
      })
    }

    return { workspaceSlug: invite.workspace.slug }
  })

  return {
    ok: true,
    workspace: {
      id: invite.workspaceId,
      name: invite.workspace.name,
      slug: result.workspaceSlug,
    },
  }
})
