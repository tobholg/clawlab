/**
 * Backfill script: Create Seat rows for all existing organizations.
 *
 * For each org:
 *   1. Create 1 OCCUPIED internal seat per active WorkspaceMember (deduplicated by userId)
 *   2. Create 1 OCCUPIED external seat per unique StakeholderAccess user
 *   3. Fill remaining plan-default capacity with AVAILABLE seats
 *
 * Run with: npx tsx scripts/backfill-seats.ts
 */

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const PLAN_LIMITS = {
  FREE: { internalSeats: 5, externalSeats: 3 },
  PRO: { internalSeats: 25, externalSeats: 25 },
  ENTERPRISE: { internalSeats: 100, externalSeats: 100 },
} as const

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      planTier: true,
      workspaces: { select: { id: true } },
    },
  })

  console.log(`Found ${orgs.length} organizations to backfill.\n`)

  for (const org of orgs) {
    // Check if already has seats (idempotent)
    const existingSeats = await prisma.seat.count({
      where: { organizationId: org.id },
    })
    if (existingSeats > 0) {
      console.log(`  [SKIP] "${org.name}" — already has ${existingSeats} seats`)
      continue
    }

    const workspaceIds = org.workspaces.map((w) => w.id)
    const limits = PLAN_LIMITS[org.planTier as keyof typeof PLAN_LIMITS] ?? PLAN_LIMITS.FREE

    // Get unique active internal members across all workspaces
    const activeMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId: { in: workspaceIds }, status: 'ACTIVE' },
      select: { userId: true },
      distinct: ['userId'],
    })

    // Get unique external stakeholders
    const stakeholders = await prisma.stakeholderAccess.findMany({
      where: { externalSpace: { project: { workspaceId: { in: workspaceIds } } } },
      select: { userId: true },
      distinct: ['userId'],
    })

    const occupiedInternal = activeMembers.length
    const occupiedExternal = stakeholders.length

    // Calculate available seats (at least enough for occupied, up to plan default)
    const totalInternal = Math.max(occupiedInternal, limits.internalSeats)
    const totalExternal = Math.max(occupiedExternal, limits.externalSeats)
    const availableInternal = totalInternal - occupiedInternal
    const availableExternal = totalExternal - occupiedExternal

    const seatsToCreate: {
      organizationId: string
      type: 'INTERNAL' | 'EXTERNAL'
      status: 'AVAILABLE' | 'OCCUPIED'
      userId: string | null
      occupiedAt: Date | null
    }[] = []

    // Occupied internal seats
    for (const member of activeMembers) {
      seatsToCreate.push({
        organizationId: org.id,
        type: 'INTERNAL',
        status: 'OCCUPIED',
        userId: member.userId,
        occupiedAt: new Date(),
      })
    }

    // Available internal seats
    for (let i = 0; i < availableInternal; i++) {
      seatsToCreate.push({
        organizationId: org.id,
        type: 'INTERNAL',
        status: 'AVAILABLE',
        userId: null,
        occupiedAt: null,
      })
    }

    // Occupied external seats
    for (const sh of stakeholders) {
      seatsToCreate.push({
        organizationId: org.id,
        type: 'EXTERNAL',
        status: 'OCCUPIED',
        userId: sh.userId,
        occupiedAt: new Date(),
      })
    }

    // Available external seats
    for (let i = 0; i < availableExternal; i++) {
      seatsToCreate.push({
        organizationId: org.id,
        type: 'EXTERNAL',
        status: 'AVAILABLE',
        userId: null,
        occupiedAt: null,
      })
    }

    if (seatsToCreate.length > 0) {
      await prisma.seat.createMany({ data: seatsToCreate })
    }

    console.log(
      `  [OK] "${org.name}" (${org.planTier}) — ` +
      `internal: ${occupiedInternal} occupied + ${availableInternal} available = ${totalInternal}, ` +
      `external: ${occupiedExternal} occupied + ${availableExternal} available = ${totalExternal}`
    )
  }

  console.log('\nBackfill complete.')
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
