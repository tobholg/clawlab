import { prisma } from './prisma'

// Plan limit definitions — must match landing page pricing
export const PLAN_LIMITS = {
  FREE: {
    internalSeats: 5,
    externalSeats: 3,
    projects: 1,
    externalSpaces: 1,
    aiCreditsPerUserPerMonth: 100,
    canPurchaseSeats: false,
  },
  PRO: {
    internalSeats: 100,
    externalSeats: 100,
    projects: 25,
    externalSpaces: 25,
    aiCreditsPerUserPerMonth: 10_000,
    canPurchaseSeats: true,
  },
  ENTERPRISE: {
    internalSeats: Infinity,
    externalSeats: Infinity,
    projects: Infinity,
    externalSpaces: Infinity,
    aiCreditsPerUserPerMonth: Infinity,
    canPurchaseSeats: true,
  },
} as const

type PlanTier = keyof typeof PLAN_LIMITS

type LimitCheck = {
  allowed: boolean
  current: number
  limit: number
}

function getLimits(tier: PlanTier) {
  return PLAN_LIMITS[tier] ?? PLAN_LIMITS.FREE
}

// ─── Projects (root-level items) ───

export async function checkCanCreateProject(workspaceId: string): Promise<LimitCheck> {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true, organization: { select: { planTier: true } } },
  })

  const limits = getLimits(workspace.organization.planTier as PlanTier)

  const current = await prisma.item.count({
    where: { workspaceId, parentId: null },
  })

  return {
    allowed: current < limits.projects,
    current,
    limit: limits.projects,
  }
}

// ─── External spaces ───

export async function checkCanCreateExternalSpace(workspaceId: string): Promise<LimitCheck> {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true, organization: { select: { planTier: true } } },
  })

  const limits = getLimits(workspace.organization.planTier as PlanTier)

  // Count external spaces across all projects in the workspace
  const current = await prisma.externalSpace.count({
    where: { project: { workspaceId } },
  })

  return {
    allowed: current < limits.externalSpaces,
    current,
    limit: limits.externalSpaces,
  }
}

// ─── External seats (stakeholder access — now based on Seat table) ───

export async function checkCanAddStakeholder(organizationId: string): Promise<LimitCheck> {
  const counts = await prisma.seat.groupBy({
    by: ['status'],
    where: { organizationId, type: 'EXTERNAL' },
    _count: true,
  })

  const total = counts.reduce((sum, c) => sum + c._count, 0)
  const available = counts.find((c) => c.status === 'AVAILABLE')?._count ?? 0

  return {
    allowed: available > 0,
    current: total - available,
    limit: total,
  }
}

// ─── AI credits (per-user per-month) ───

export async function checkCanUseAICredit(
  organizationId: string,
  userId: string,
): Promise<LimitCheck> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { planTier: true },
  })

  const limits = getLimits(org.planTier as PlanTier)
  const month = new Date().toISOString().slice(0, 7) // "2026-02"

  const usage = await prisma.userMonthlyUsage.findUnique({
    where: {
      organizationId_userId_month: { organizationId, userId, month },
    },
  })

  const current = usage?.aiCreditsUsed ?? 0

  return {
    allowed: current < limits.aiCreditsPerUserPerMonth,
    current,
    limit: limits.aiCreditsPerUserPerMonth,
  }
}

// ─── Increment AI credit usage ───

export async function consumeAICredit(
  organizationId: string,
  userId: string,
  credits: number = 1,
): Promise<void> {
  const month = new Date().toISOString().slice(0, 7)

  await prisma.userMonthlyUsage.upsert({
    where: {
      organizationId_userId_month: { organizationId, userId, month },
    },
    create: {
      organizationId,
      userId,
      month,
      aiCreditsUsed: credits,
    },
    update: {
      aiCreditsUsed: { increment: credits },
    },
  })
}

// ─── Get full usage summary for an organization (seat-based) ───

export async function getOrganizationUsage(organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      planTier: true,
      workspaces: { select: { id: true } },
    },
  })

  const limits = getLimits(org.planTier as PlanTier)
  const workspaceIds = org.workspaces.map((w) => w.id)

  // Query seats grouped by type + status
  const seatCounts = await prisma.seat.groupBy({
    by: ['type', 'status'],
    where: { organizationId },
    _count: true,
  })

  const countSeat = (type: string, status?: string) => {
    if (status) {
      return seatCounts.find((c) => c.type === type && c.status === status)?._count ?? 0
    }
    return seatCounts.filter((c) => c.type === type).reduce((sum, c) => sum + c._count, 0)
  }

  const [projectCount, externalSpaceCount] = await Promise.all([
    prisma.item.count({
      where: { workspaceId: { in: workspaceIds }, parentId: null },
    }),
    prisma.externalSpace.count({
      where: { project: { workspaceId: { in: workspaceIds } } },
    }),
  ])

  return {
    planTier: org.planTier,
    limits,
    usage: {
      internalSeats: {
        total: countSeat('INTERNAL'),
        available: countSeat('INTERNAL', 'AVAILABLE'),
        invited: countSeat('INTERNAL', 'INVITED'),
        occupied: countSeat('INTERNAL', 'OCCUPIED'),
      },
      externalSeats: {
        total: countSeat('EXTERNAL'),
        available: countSeat('EXTERNAL', 'AVAILABLE'),
        invited: countSeat('EXTERNAL', 'INVITED'),
        occupied: countSeat('EXTERNAL', 'OCCUPIED'),
      },
      projects: { current: projectCount, limit: limits.projects },
      externalSpaces: { current: externalSpaceCount, limit: limits.externalSpaces },
    },
  }
}
