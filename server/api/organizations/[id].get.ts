import { requireOrgAdmin } from '../../utils/auth'
import { getOrganizationUsage, checkCanUseAICredit } from '../../utils/planLimits'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')
  if (!organizationId) {
    throw createError({ statusCode: 400, message: 'Organization ID is required' })
  }

  const auth = await requireOrgAdmin(event, organizationId)

  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      billingEmail: true,
      planTier: true,
      trialEndsAt: true,
      createdAt: true,
    },
  })

  const [usage, aiCredits] = await Promise.all([
    getOrganizationUsage(organizationId),
    checkCanUseAICredit(organizationId, auth.user.id),
  ])

  return {
    ...org,
    ...usage,
    aiCredits: {
      current: aiCredits.current,
      limit: aiCredits.limit,
    },
    orgRole: auth.orgRole,
  }
})
