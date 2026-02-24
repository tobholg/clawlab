import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { PLAN_LIMITS, isPlanLimitsEnabled } from '../../utils/planLimits'
import { MAX_PRO_SEATS, calculateMarginalCost, getMarginalBreakdown } from '../../utils/pricing'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const { workspaceId, count, type } = body

  if (!workspaceId || !count || !type) {
    throw createError({ statusCode: 400, message: 'workspaceId, count, and type are required' })
  }

  if (!['INTERNAL', 'EXTERNAL'].includes(type)) {
    throw createError({ statusCode: 400, message: 'type must be INTERNAL or EXTERNAL' })
  }

  if (typeof count !== 'number' || count < 1 || count > 100) {
    throw createError({ statusCode: 400, message: 'count must be between 1 and 100' })
  }

  // Require OWNER role
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })
  if (!membership || membership.status !== 'ACTIVE' || membership.role !== 'OWNER') {
    throw createError({ statusCode: 403, message: 'Only the workspace owner can purchase seats' })
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true, organization: { select: { planTier: true } } },
  })

  const limitsEnabled = isPlanLimitsEnabled()
  const tier = workspace.organization.planTier as keyof typeof PLAN_LIMITS
  if (limitsEnabled && !PLAN_LIMITS[tier]?.canPurchaseSeats) {
    throw createError({ statusCode: 403, message: 'Seat purchases are disabled by the current limits configuration' })
  }

  // Cap enforcement when plan limits are enabled for PRO
  if (limitsEnabled && tier === 'PRO') {
    const existing = await prisma.seat.count({
      where: { organizationId: workspace.organizationId, type: type as 'INTERNAL' | 'EXTERNAL' },
    })
    if (existing + count > MAX_PRO_SEATS) {
      throw createError({
        statusCode: 400,
        message: `Cannot exceed ${MAX_PRO_SEATS} ${type.toLowerCase()} seats with current configured limits. Currently ${existing}, requesting ${count}.`,
      })
    }

    // Compute marginal cost
    const additionalMonthlyCost = calculateMarginalCost(existing, count, type as 'INTERNAL' | 'EXTERNAL')
    const breakdown = getMarginalBreakdown(existing, count, type as 'INTERNAL' | 'EXTERNAL')

    // Create the new seat rows
    const seats = Array.from({ length: count }, () => ({
      organizationId: workspace.organizationId,
      type: type as 'INTERNAL' | 'EXTERNAL',
      status: 'AVAILABLE' as const,
    }))

    await prisma.seat.createMany({ data: seats })

    return { ok: true, added: count, type, additionalMonthlyCost, breakdown }
  }

  // ENTERPRISE — no cap, no pricing
  const seats = Array.from({ length: count }, () => ({
    organizationId: workspace.organizationId,
    type: type as 'INTERNAL' | 'EXTERNAL',
    status: 'AVAILABLE' as const,
  }))

  await prisma.seat.createMany({ data: seats })

  return { ok: true, added: count, type }
})
