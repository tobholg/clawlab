import type { AgentContextUser } from '../utils/agentApi'
import { compareAgentApiKey } from '../utils/agentKeyHash'
import { prisma } from '../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.path.startsWith('/api/agents')) {
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

  const agentCandidates = await prisma.user.findMany({
    where: {
      isAgent: true,
      apiKeyHash: { not: null },
    },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      isAgent: true,
      agentProvider: true,
      apiKeyHash: true,
    },
  })

  let authenticatedAgent: AgentContextUser | null = null

  for (const candidate of agentCandidates) {
    if (!candidate.apiKeyHash) continue

    const isMatch = await compareAgentApiKey(apiKey, candidate.apiKeyHash)
    if (!isMatch) continue

    authenticatedAgent = {
      id: candidate.id,
      email: candidate.email,
      name: candidate.name,
      avatar: candidate.avatar,
      isAgent: candidate.isAgent,
      agentProvider: candidate.agentProvider,
    }
    break
  }

  if (!authenticatedAgent) {
    throw createError({ statusCode: 401, message: 'Invalid API key' })
  }

  ;(event.context as { agentUser?: AgentContextUser }).agentUser = authenticatedAgent
})
