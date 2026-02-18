import type { AgentContextUser } from '../utils/agentApi'
import { prisma } from '../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/agents')) {
    return
  }

  // Allow unauthenticated access to discovery endpoints
  if (
    event.path === '/api/agents' ||
    event.path === '/api/agents/' ||
    event.path === '/api/agents/index' ||
    event.path === '/api/agents/index/' ||
    event.path.startsWith('/api/agents/index/')
  ) {
    return
  }

  // Terminal endpoints use session auth (requireUser), not agent auth
  if (event.path.startsWith('/api/agents/terminals')) {
    return
  }

  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, message: 'Missing or invalid API key' })
  }

  const apiKey = authHeader.slice(7).trim()
  if (!apiKey.startsWith('ctx_')) {
    throw createError({ statusCode: 401, message: 'Missing or invalid API key' })
  }

  // Direct lookup by plain text token
  const agent = await prisma.user.findUnique({
    where: {
      apiToken: apiKey,
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      isAgent: true,
      agentProvider: true,
    },
  })

  if (!agent || !agent.isAgent) {
    throw createError({ statusCode: 401, message: 'Invalid API key' })
  }

  ;(event.context as { agentUser?: AgentContextUser }).agentUser = {
    id: agent.id,
    email: agent.email,
    name: agent.name,
    avatar: agent.avatar,
    isAgent: agent.isAgent,
    agentProvider: agent.agentProvider,
  }
})
