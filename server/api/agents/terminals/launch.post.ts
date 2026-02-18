import { requireUser, requireWorkspaceMember } from '../../../utils/auth'
import { createPtySession, destroyPtySession, generateTerminalId, getPtySession, writeToPty } from '../../../utils/ptyManager'
import { prisma } from '../../../utils/prisma'

function toStringEnv(env: NodeJS.ProcessEnv) {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') normalized[key] = value
  }
  return normalized
}

/**
 * One-click terminal launch. Takes an agentId (and optional taskId),
 * creates an AgentSession if needed, and spawns the PTY.
 * 
 * The agentToken must still be provided (tokens are stored hashed).
 * The frontend stores it in localStorage when the user first creates the agent.
 */
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody<{
    agentId: string
    agentToken: string
    taskId?: string
    cwd?: string
    cols?: number
    rows?: number
  }>(event)

  const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : ''
  const agentToken = typeof body.agentToken === 'string' ? body.agentToken.trim() : ''

  if (!agentId) throw createError({ statusCode: 400, message: 'agentId is required' })
  if (!agentToken) throw createError({ statusCode: 400, message: 'agentToken is required' })

  // Look up agent
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      name: true,
      isAgent: true,
      workspaceMemberships: {
        select: { workspaceId: true },
        take: 1,
      },
    },
  })

  if (!agent || !agent.isAgent) {
    throw createError({ statusCode: 404, message: 'Agent not found' })
  }

  const workspaceId = agent.workspaceMemberships[0]?.workspaceId
  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'Agent has no workspace' })
  }

  await requireWorkspaceMember(event, workspaceId)

  const agentName = agent.name || 'Agent'
  const taskId = typeof body.taskId === 'string' ? body.taskId.trim() : undefined

  // Resolve task + project for cwd
  let task: any = null
  let projectRepoPath: string | null = null

  if (taskId) {
    task = await prisma.item.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, projectId: true, status: true },
    })
  }

  const projectId = task?.projectId ?? null
  if (projectId) {
    const project = await prisma.item.findUnique({
      where: { id: projectId },
      select: { repoPath: true },
    })
    projectRepoPath = project?.repoPath ?? null
  }

  // Check for existing active session for this agent+task
  let session = await prisma.agentSession.findFirst({
    where: {
      agentId,
      ...(taskId ? { itemId: taskId } : {}),
      status: 'ACTIVE',
    },
    orderBy: { updatedAt: 'desc' },
  })

  // If existing session has a live terminal, reuse it
  if (session?.terminalId) {
    const existingPty = getPtySession(session.terminalId)
    if (existingPty) {
      return {
        terminalId: session.terminalId,
        agentSessionId: session.id,
        agentName,
        taskTitle: task?.title ?? null,
        taskId: task?.id ?? null,
        reused: true,
      }
    }
  }

  // Create new session if needed
  if (!session) {
    session = await prisma.agentSession.create({
      data: {
        agentId,
        itemId: taskId ?? null,
        projectId,
        checkedOutAt: new Date(),
        status: 'ACTIVE',
      },
    })
  }

  // Spawn terminal
  const terminalId = generateTerminalId()
  const cwdOverride = typeof body.cwd === 'string' ? body.cwd.trim() : ''
  const cwd = cwdOverride || projectRepoPath || process.cwd()
  const origin = getRequestURL(event).origin || 'http://localhost:3001'

  const env: Record<string, string> = {
    ...toStringEnv(process.env),
    CTX_TOKEN: agentToken,
    CTX_BASE_URL: origin,
    CTX_AGENT_SESSION: session.id,
    CTX_AGENT_NAME: agentName,
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

  setTimeout(() => {
    writeToPty(terminalId, 'export PS1="\\033[35m${CTX_AGENT_NAME:-agent}\\033[0m \\033[34m\\w\\033[0m $ "\n')
    writeToPty(terminalId, 'echo "\\033[35m═══ OpenContext Agent Terminal ═══\\033[0m"\n')
    writeToPty(terminalId, `echo "Agent: ${agentName}"\n`)
    writeToPty(terminalId, `echo "Session: ${session!.id}"\n`)
    if (task) {
      writeToPty(terminalId, `echo "Task: ${task.title}"\n`)
    }
    writeToPty(terminalId, 'echo ""\n')
  }, 300)

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
    agentName,
    taskTitle: task?.title ?? null,
    taskId: task?.id ?? null,
    reused: false,
  }
})
