import { requireUser, requireWorkspaceMember } from '../../utils/auth'
import { createPtySession, destroyPtySession, generateTerminalId, getPtySession } from '../../utils/ptyManager'
import { prisma } from '../../utils/prisma'

function toStringEnv(env: NodeJS.ProcessEnv) {
  const normalized: Record<string, string> = {}

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      normalized[key] = value
    }
  }

  return normalized
}

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody<{
    agentSessionId?: string
    agentToken?: string
    cwd?: string
    cols?: number
    rows?: number
  }>(event)

  const agentSessionId = typeof body.agentSessionId === 'string' ? body.agentSessionId.trim() : ''
  const agentToken = typeof body.agentToken === 'string' ? body.agentToken.trim() : ''

  if (!agentSessionId) {
    throw createError({ statusCode: 400, message: 'agentSessionId is required' })
  }

  if (!agentToken) {
    throw createError({ statusCode: 400, message: 'agentToken is required' })
  }

  const session = await prisma.agentSession.findUnique({
    where: { id: agentSessionId },
    select: {
      id: true,
      terminalId: true,
      projectId: true,
      itemId: true,
      item: {
        select: {
          id: true,
          workspaceId: true,
          projectId: true,
        },
      },
    },
  })

  if (!session) {
    throw createError({ statusCode: 404, message: 'Agent session not found' })
  }

  const resolvedProjectId = session.projectId ?? session.item?.projectId ?? session.itemId ?? null
  const project = resolvedProjectId
    ? await prisma.item.findUnique({
        where: { id: resolvedProjectId },
        select: {
          id: true,
          workspaceId: true,
          repoPath: true,
        },
      })
    : null

  const workspaceId = session.item?.workspaceId ?? project?.workspaceId ?? null
  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'Unable to resolve workspace for agent session' })
  }

  await requireWorkspaceMember(event, workspaceId)

  if (session.terminalId) {
    const existingSession = getPtySession(session.terminalId)
    if (existingSession?.agentSessionId === session.id) {
      return {
        terminalId: existingSession.id,
        agentSessionId: session.id,
      }
    }
  }

  const terminalId = generateTerminalId()
  const cwdOverride = typeof body.cwd === 'string' ? body.cwd.trim() : ''
  const cwd = cwdOverride || project?.repoPath || process.cwd()

  const origin = getRequestURL(event).origin || 'http://localhost:3001'
  const env: Record<string, string> = {
    ...toStringEnv(process.env),
    CTX_TOKEN: agentToken,
    CTX_BASE_URL: origin,
    CTX_AGENT_SESSION: session.id,
    TERM: 'xterm-256color',
  }

  createPtySession({
    terminalId,
    agentSessionId: session.id,
    cwd,
    env,
    cols: typeof body.cols === 'number' ? body.cols : undefined,
    rows: typeof body.rows === 'number' ? body.rows : undefined,
  })

  try {
    await prisma.agentSession.update({
      where: { id: session.id },
      data: { terminalId },
    })
  } catch (error) {
    destroyPtySession(terminalId)
    throw error
  }

  return {
    terminalId,
    agentSessionId: session.id,
  }
})
