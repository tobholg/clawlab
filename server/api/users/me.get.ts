import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      position: true,
      createdAt: true,
    },
  })

  // Get org membership + seat info
  const orgMembership = await prisma.organizationMember.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          planTier: true,
        },
      },
    },
  })

  // Get seat type for this user
  const seat = orgMembership
    ? await prisma.seat.findFirst({
        where: {
          organizationId: orgMembership.organization.id,
          userId: user.id,
          status: 'OCCUPIED',
        },
        select: { type: true },
      })
    : null

  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    organization: orgMembership
      ? {
          id: orgMembership.organization.id,
          name: orgMembership.organization.name,
          planTier: orgMembership.organization.planTier,
          role: orgMembership.role,
        }
      : null,
    seatType: seat?.type ?? null,
  }
})
