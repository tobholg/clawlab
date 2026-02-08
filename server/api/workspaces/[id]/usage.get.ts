import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/auth'
import { getOrganizationUsage, checkCanUseAICredit } from '../../../utils/planLimits'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const workspaceId = getRouterParam(event, 'id')

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  }

  // Verify membership
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })

  if (!membership || membership.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, message: 'Not a workspace member' })
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { organizationId: true },
  })

  const orgUsage = await getOrganizationUsage(workspace.organizationId)

  // Also get the current user's AI credit usage
  const aiCredits = await checkCanUseAICredit(workspace.organizationId, user.id)

  return {
    ...orgUsage,
    aiCredits: {
      current: aiCredits.current,
      limit: aiCredits.limit,
    },
  }
})
