import { randomBytes } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { requireMinRole, requireWorkspaceMember } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'
import { defaultRunnerCommandForProvider } from '../../../../utils/agentRunner'

const VALID_PROVIDERS = new Set(['openclaw', 'cursor', 'codex', 'custom'])

const toSlug = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const makeAgentEmail = (name: string) => {
  const slug = toSlug(name) || 'agent'
  const suffix = randomBytes(4).toString('hex')
  return `agent-${slug}-${suffix}@agents.context.local`
}

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)
  requireMinRole(auth, 'ADMIN')

  if (!auth.isOrgAdmin) {
    throw createError({ statusCode: 403, message: 'Organization admin access required' })
  }

  const body = await readBody(event)
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const provider = typeof body.provider === 'string' ? body.provider.toLowerCase().trim() : ''

  if (!name) {
    throw createError({ statusCode: 400, message: 'name is required' })
  }

  if (name.length > 80) {
    throw createError({ statusCode: 400, message: 'name must be 80 characters or fewer' })
  }

  if (!VALID_PROVIDERS.has(provider)) {
    throw createError({ statusCode: 400, message: 'provider must be one of: openclaw, cursor, codex, custom' })
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, organizationId: true },
  })

  if (!workspace) {
    throw createError({ statusCode: 404, message: 'Workspace not found' })
  }

  let createdAgent: { id: string; name: string | null; agentProvider: string | null; createdAt: Date } | null = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const email = makeAgentEmail(name)

      createdAgent = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            isAgent: true,
            agentProvider: provider,
            runnerCommand: defaultRunnerCommandForProvider(provider),
          },
          select: {
            id: true,
            name: true,
            agentProvider: true,
            createdAt: true,
          },
        })

        await tx.organizationMember.create({
          data: {
            organizationId: workspace.organizationId,
            userId: user.id,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
        })

        await tx.workspaceMember.create({
          data: {
            workspaceId,
            userId: user.id,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
        })

        return user
      })

      break
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        attempt < 2
      ) {
        continue
      }
      throw error
    }
  }

  if (!createdAgent) {
    throw createError({ statusCode: 500, message: 'Failed to create agent' })
  }

  return {
    id: createdAgent.id,
    name: createdAgent.name ?? name,
    provider: createdAgent.agentProvider ?? provider,
    createdAt: createdAgent.createdAt.toISOString(),
  }
})
