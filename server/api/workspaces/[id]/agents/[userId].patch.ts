import { requireMinRole, requireWorkspaceMember } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

const VALID_PROVIDERS = new Set(['openclaw', 'cursor', 'codex', 'custom'])

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const userId = getRouterParam(event, 'userId')

  if (!workspaceId || !userId) {
    throw createError({ statusCode: 400, message: 'Workspace ID and user ID are required' })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)
  requireMinRole(auth, 'ADMIN')

  if (!auth.isOrgAdmin) {
    throw createError({ statusCode: 403, message: 'Organization admin access required' })
  }

  const body = await readBody(event)
  const hasName = Object.prototype.hasOwnProperty.call(body, 'name')
  const hasProvider = Object.prototype.hasOwnProperty.call(body, 'provider')

  if (!hasName && !hasProvider) {
    throw createError({ statusCode: 400, message: 'No changes provided' })
  }

  const nextName = hasName && typeof body.name === 'string' ? body.name.trim() : undefined
  const nextProvider = hasProvider && typeof body.provider === 'string' ? body.provider.toLowerCase().trim() : undefined

  if (hasName && (!nextName || nextName.length > 80)) {
    throw createError({ statusCode: 400, message: 'name must be 1 to 80 characters' })
  }

  if (hasProvider && (!nextProvider || !VALID_PROVIDERS.has(nextProvider))) {
    throw createError({ statusCode: 400, message: 'provider must be one of: openclaw, cursor, codex, custom' })
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId,
      },
    },
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          isAgent: true,
        },
      },
    },
  })

  if (!membership) {
    throw createError({ statusCode: 404, message: 'Agent not found in workspace' })
  }

  if (!membership.user.isAgent) {
    throw createError({ statusCode: 400, message: 'Target user is not an agent' })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(hasName ? { name: nextName } : {}),
      ...(hasProvider ? { agentProvider: nextProvider } : {}),
    },
    select: {
      id: true,
      name: true,
      agentProvider: true,
      updatedAt: true,
    },
  })

  return {
    id: updated.id,
    name: updated.name,
    provider: updated.agentProvider,
    updatedAt: updated.updatedAt.toISOString(),
  }
})
