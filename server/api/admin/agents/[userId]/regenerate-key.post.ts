import { randomBytes } from 'node:crypto'
import { requireUser } from '../../../../utils/auth'
import { hashAgentApiKey } from '../../../../utils/agentKeyHash'
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

  const adminOrgIds = new Set(adminOrgMemberships.map((membership) => membership.organizationId))
  const hasSharedAdminOrg = targetAgent.organizationMembers.some((membership) =>
    adminOrgIds.has(membership.organizationId)
  )

  if (!hasSharedAdminOrg) {
    throw createError({ statusCode: 403, message: 'Organization admin access required' })
  }

  const apiKey = `ctx_${randomBytes(20).toString('hex')}`
  const apiKeyHash = await hashAgentApiKey(apiKey)

  await prisma.user.update({
    where: { id: targetAgent.id },
    data: { apiKeyHash },
  })

  return { apiKey }
})
