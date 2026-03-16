import { requireMinRole, requireWorkspaceMember } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { VALID_AGENT_PROVIDERS, defaultRunnerCommandForProvider } from '../../../../utils/agentRunner'

const VALID_PROVIDERS = new Set(VALID_AGENT_PROVIDERS)

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
  const hasRunner = Object.prototype.hasOwnProperty.call(body, 'runnerCommand')
  const hasRunnerArgs = Object.prototype.hasOwnProperty.call(body, 'runnerArgs')

  if (!hasName && !hasProvider && !hasRunner && !hasRunnerArgs) {
    throw createError({ statusCode: 400, message: 'No changes provided' })
  }

  const nextName = hasName && typeof body.name === 'string' ? body.name.trim() : undefined
  const nextProvider = hasProvider && typeof body.provider === 'string' ? body.provider.toLowerCase().trim() : undefined
  const nextRunner = hasRunner ? (typeof body.runnerCommand === 'string' ? body.runnerCommand.trim() : null) : undefined
  const nextRunnerArgs = hasRunnerArgs ? (typeof body.runnerArgs === 'string' ? body.runnerArgs.trim() : null) : undefined

  if (hasName && (!nextName || nextName.length > 80)) {
    throw createError({ statusCode: 400, message: 'name must be 1 to 80 characters' })
  }

  if (hasProvider && (!nextProvider || !VALID_PROVIDERS.has(nextProvider))) {
    throw createError({ statusCode: 400, message: 'provider must be one of: openclaw, cursor, claude, codex, custom' })
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
          runnerCommand: true,
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

  let resolvedRunner = hasRunner ? nextRunner : undefined
  if (!hasRunner && hasProvider && nextProvider && !membership.user.runnerCommand) {
    resolvedRunner = defaultRunnerCommandForProvider(nextProvider)
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(hasName ? { name: nextName } : {}),
      ...(hasProvider ? { agentProvider: nextProvider } : {}),
      ...(resolvedRunner !== undefined ? { runnerCommand: resolvedRunner } : {}),
      ...(hasRunnerArgs ? { runnerArgs: nextRunnerArgs } : {}),
    },
    select: {
      id: true,
      name: true,
      agentProvider: true,
      runnerCommand: true,
      runnerArgs: true,
      updatedAt: true,
    },
  })

  return {
    id: updated.id,
    name: updated.name,
    provider: updated.agentProvider,
    runnerCommand: updated.runnerCommand,
    runnerArgs: updated.runnerArgs,
    updatedAt: updated.updatedAt.toISOString(),
  }
})
