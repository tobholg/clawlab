import { requireUser } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, 'userId')
  if (!userId) {
    throw createError({ statusCode: 400, message: 'User ID is required' })
  }

  const user = await requireUser(event)

  const [targetAgent, adminOrgMemberships] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isAgent: true,
        apiToken: true,
        organizationMembers: {
          where: { status: 'ACTIVE' },
          select: { organizationId: true },
        },
      },
    }),
    prisma.organizationMember.findMany({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { organizationId: true },
    }),
  ])

  if (!targetAgent) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  if (!targetAgent.isAgent) {
    throw createError({ statusCode: 400, message: 'Target user is not an agent' })
  }

  const adminOrgIds = new Set(adminOrgMemberships.map((m) => m.organizationId))
  const hasSharedAdminOrg = targetAgent.organizationMembers.some((m) =>
    adminOrgIds.has(m.organizationId)
  )

  if (!hasSharedAdminOrg) {
    throw createError({ statusCode: 403, message: 'Organization admin access required' })
  }

  return { apiKey: targetAgent.apiToken }
})
