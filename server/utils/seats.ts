import { prisma } from './prisma'
import { PLAN_LIMITS } from './planLimits'
import type { PlanTier, SeatType } from '@prisma/client'

/**
 * Provision default seat rows for a new organization based on its plan tier.
 * Creates AVAILABLE seats up to the plan default.
 */
export async function provisionDefaultSeats(
  organizationId: string,
  tier: PlanTier,
  tx: any = prisma,
) {
  const limits = PLAN_LIMITS[tier] ?? PLAN_LIMITS.FREE
  // PRO provisions 0 seats — user buys during upgrade. ENTERPRISE also 0.
  const internalCount = tier === 'FREE' ? limits.internalSeats : 0
  const externalCount = tier === 'FREE' ? limits.externalSeats : 0

  const seats: { organizationId: string; type: SeatType; status: 'AVAILABLE' }[] = []

  for (let i = 0; i < internalCount; i++) {
    seats.push({ organizationId, type: 'INTERNAL', status: 'AVAILABLE' })
  }
  for (let i = 0; i < externalCount; i++) {
    seats.push({ organizationId, type: 'EXTERNAL', status: 'AVAILABLE' })
  }

  if (seats.length > 0) {
    await tx.seat.createMany({ data: seats })
  }
}

/**
 * Find the first available seat of a given type for an organization.
 */
export async function findAvailableSeat(organizationId: string, type: SeatType) {
  return prisma.seat.findFirst({
    where: { organizationId, type, status: 'AVAILABLE' },
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Check if a user already occupies a seat in the organization (prevents double-seating).
 */
export async function checkUserAlreadySeated(organizationId: string, userId: string) {
  const seat = await prisma.seat.findFirst({
    where: { organizationId, userId, status: 'OCCUPIED' },
  })
  return !!seat
}

/**
 * Lazily expire stale pending invites (past expiresAt) — marks them EXPIRED
 * and frees up their seats back to AVAILABLE.
 */
export async function expireStaleInvites(organizationId: string) {
  const stale = await prisma.seatInvite.findMany({
    where: {
      organizationId,
      status: 'PENDING',
      expiresAt: { lt: new Date() },
    },
    select: { id: true, seatId: true },
  })

  if (stale.length === 0) return

  await prisma.$transaction([
    prisma.seatInvite.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: 'EXPIRED' },
    }),
    prisma.seat.updateMany({
      where: { id: { in: stale.map((s) => s.seatId) } },
      data: { status: 'AVAILABLE', userId: null },
    }),
  ])
}
