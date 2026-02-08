import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMember, requireMinRole } from '../../../utils/auth'
import { PLAN_LIMITS } from '../../../utils/planLimits'
import { MAX_PRO_SEATS, calculateSeatCost, getSeatBreakdown } from '../../../utils/pricing'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)
  requireMinRole(auth, 'OWNER')

  const body = await readBody(event)
  const { planTier, internalSeats, externalSeats } = body

  if (!planTier) {
    throw createError({ statusCode: 400, message: 'planTier is required' })
  }

  if (!['FREE', 'PRO', 'ENTERPRISE'].includes(planTier)) {
    throw createError({ statusCode: 400, message: 'Invalid plan tier' })
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true },
  })

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: workspace.organizationId },
    select: { planTier: true },
  })

  if (org.planTier === planTier) {
    throw createError({ statusCode: 400, message: 'Already on this plan' })
  }

  const organizationId = workspace.organizationId

  // FREE -> PRO upgrade with seat counts
  if (org.planTier === 'FREE' && planTier === 'PRO') {
    const reqInternal = typeof internalSeats === 'number' ? internalSeats : 1
    const reqExternal = typeof externalSeats === 'number' ? externalSeats : 0

    if (reqInternal < 1 || reqInternal > MAX_PRO_SEATS) {
      throw createError({ statusCode: 400, message: `Internal seats must be between 1 and ${MAX_PRO_SEATS}` })
    }
    if (reqExternal < 0 || reqExternal > MAX_PRO_SEATS) {
      throw createError({ statusCode: 400, message: `External seats must be between 0 and ${MAX_PRO_SEATS}` })
    }

    // Count currently occupied seats (must not go below these)
    const occupiedInternal = await prisma.seat.count({
      where: { organizationId, type: 'INTERNAL', status: 'OCCUPIED' },
    })
    const occupiedExternal = await prisma.seat.count({
      where: { organizationId, type: 'EXTERNAL', status: 'OCCUPIED' },
    })

    if (reqInternal < occupiedInternal) {
      throw createError({ statusCode: 400, message: `Cannot have fewer internal seats than currently occupied (${occupiedInternal})` })
    }
    if (reqExternal < occupiedExternal) {
      throw createError({ statusCode: 400, message: `Cannot have fewer external seats than currently occupied (${occupiedExternal})` })
    }

    await prisma.$transaction(async (tx) => {
      // Update plan
      await tx.organization.update({
        where: { id: organizationId },
        data: { planTier },
      })

      // Delete old FREE AVAILABLE seats (non-occupied, non-invited)
      await tx.seat.deleteMany({
        where: { organizationId, status: 'AVAILABLE' },
      })

      // Create requested seats as AVAILABLE
      const newSeats: { organizationId: string; type: 'INTERNAL' | 'EXTERNAL'; status: 'AVAILABLE' }[] = []

      // We need (reqInternal - occupiedInternal) new available internal seats
      // (occupied seats already exist and stay)
      const internalInvited = await tx.seat.count({
        where: { organizationId, type: 'INTERNAL', status: 'INVITED' },
      })
      const externalInvited = await tx.seat.count({
        where: { organizationId, type: 'EXTERNAL', status: 'INVITED' },
      })

      const internalToCreate = reqInternal - occupiedInternal - internalInvited
      const externalToCreate = reqExternal - occupiedExternal - externalInvited

      for (let i = 0; i < Math.max(0, internalToCreate); i++) {
        newSeats.push({ organizationId, type: 'INTERNAL', status: 'AVAILABLE' })
      }
      for (let i = 0; i < Math.max(0, externalToCreate); i++) {
        newSeats.push({ organizationId, type: 'EXTERNAL', status: 'AVAILABLE' })
      }

      if (newSeats.length > 0) {
        await tx.seat.createMany({ data: newSeats })
      }
    })

    // Return cost breakdown
    const internalCost = calculateSeatCost(reqInternal, 'INTERNAL')
    const externalCost = reqExternal > 0 ? calculateSeatCost(reqExternal, 'EXTERNAL') : 0
    const internalBreakdown = getSeatBreakdown(reqInternal, 'INTERNAL')
    const externalBreakdown = reqExternal > 0 ? getSeatBreakdown(reqExternal, 'EXTERNAL') : []

    return {
      ok: true,
      planTier,
      internalSeats: reqInternal,
      externalSeats: reqExternal,
      monthlyCost: internalCost + externalCost,
      breakdown: {
        internal: { total: internalCost, lines: internalBreakdown },
        external: { total: externalCost, lines: externalBreakdown },
      },
    }
  }

  // Other plan changes (PRO->FREE downgrade, ENTERPRISE, etc.)
  await prisma.organization.update({
    where: { id: organizationId },
    data: { planTier },
  })

  return { ok: true, planTier }
})
