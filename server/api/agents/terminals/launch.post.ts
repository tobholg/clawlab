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

const DEFAULT_SYSTEM_PROMPT = `You are {{agentName}}, an AI agent working in OpenContext.
You have a CLI tool called \`ctx\`. Run \`ctx help\` to discover available commands, then run \`ctx catchup\` to see your current assignments and recent activity.
Use ctx to manage your work: check out tasks, update progress, add comments, and submit for review when done.`

function buildSystemPrompt(agentName: string): string {
  return DEFAULT_SYSTEM_PROMPT.replace(/\{\{agentName\}\}/g, agentName)
}

function buildLaunchCommand(runner: string | null, args: string | null, systemPrompt: string): string | null {
  if (!runner) return null // plain terminal, no agent CLI

  const parts = [runner]

  // Add system prompt flag based on runner
  if (runner === 'codex') {
    parts.push('-s', JSON.stringify(systemPrompt))
  } else if (runner === 'claude') {
    parts.push('--system-prompt', JSON.stringify(systemPrompt))
  } else if (runner === 'aider') {
    parts.push('--message', JSON.stringify(systemPrompt))
  }

  // Add extra args
  if (args?.trim()) {
    parts.push(args.trim())
  }

  return parts.join(' ')
}

/**
 * One-click terminal launch.
 * - If agentId provided: launches agent terminal with runner config + bootstrap
 * - If no agentId: launches plain terminal in project directory
 */
export default defineEventHandler(async (event) => {
  await requireUser(event)
  const body = await readBody<{
    agentId?: string
    taskId?: string
    projectId?: string
    cwd?: string
    cols?: number
    rows?: number
  }>(event)

  const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : undefined
  const taskId = typeof body.taskId === 'string' ? body.taskId.trim() : undefined
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : undefined

  // Resolve agent (if launching an agent terminal)
  let agent: {
    id: string
    name: string | null
    apiToken: string | null
    runnerCommand: string | null
    runnerArgs: string | null
    workspaceId: string | null
  } | null = null

  if (agentId) {
    const agentUser = await prisma.user.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        isAgent: true,
        apiToken: true,
        runnerCommand: true,
        runnerArgs: true,
        workspaceMemberships: {
          select: { workspaceId: true },
          take: 1,
        },
      },
    })

    if (!agentUser || !agentUser.isAgent) {
      throw createError({ statusCode: 404, message: 'Agent not found' })
    }

    agent = {
      id: agentUser.id,
      name: agentUser.name,
      apiToken: agentUser.apiToken,
      runnerCommand: agentUser.runnerCommand,
      runnerArgs: agentUser.runnerArgs,
      workspaceId: agentUser.workspaceMemberships[0]?.workspaceId ?? null,
    }

    if (agent.workspaceId) {
      await requireWorkspaceMember(event, agent.workspaceId)
    }
  }

  // Resolve task + project for cwd
  let task: any = null
  let resolvedProjectId = projectId ?? null

  if (taskId) {
    task = await prisma.item.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, projectId: true, workspaceId: true },
    })
    if (task?.projectId) resolvedProjectId = task.projectId
  }

  let projectRepoPath: string | null = null
  let workspaceId: string | null = agent?.workspaceId ?? task?.workspaceId ?? null

  if (resolvedProjectId) {
    const project = await prisma.item.findUnique({
      where: { id: resolvedProjectId },
      select: { repoPath: true, workspaceId: true },
    })
    projectRepoPath = project?.repoPath ?? null
    if (!workspaceId) workspaceId = project?.workspaceId ?? null
  }

  if (workspaceId) {
    await requireWorkspaceMember(event, workspaceId)
  }

  // For agent terminals, create/reuse AgentSession
  let session: any = null

  if (agent) {
    session = await prisma.agentSession.findFirst({
      where: {
        agentId: agent.id,
        ...(taskId ? { itemId: taskId } : {}),
        status: 'ACTIVE',
      },
      orderBy: { updatedAt: 'desc' },
    })

    // Reuse existing terminal if still alive
    if (session?.terminalId) {
      const existingPty = getPtySession(session.terminalId)
      if (existingPty) {
        return {
          terminalId: session.terminalId,
          agentSessionId: session.id,
          agentName: agent.name,
          taskTitle: task?.title ?? null,
          taskId: task?.id ?? null,
          isPlainTerminal: false,
          reused: true,
        }
      }
    }

    if (!session) {
      session = await prisma.agentSession.create({
        data: {
          agentId: agent.id,
          itemId: taskId ?? null,
          projectId: resolvedProjectId,
          checkedOutAt: new Date(),
          status: 'ACTIVE',
        },
      })
    }
  }

  // Spawn terminal
  const terminalId = generateTerminalId()
  const cwdOverride = typeof body.cwd === 'string' ? body.cwd.trim() : ''
  const cwd = cwdOverride || projectRepoPath || process.cwd()
  const origin = getRequestURL(event).origin || 'http://localhost:3001'
  const agentName = agent?.name || 'Terminal'

  const env: Record<string, string> = {
    ...toStringEnv(process.env),
    TERM: 'xterm-256color',
  }

  // Add agent-specific env vars
  if (agent) {
    if (agent.apiToken) env.CTX_TOKEN = agent.apiToken
    env.CTX_BASE_URL = origin
    env.CTX_AGENT_SESSION = session?.id ?? ''
    env.CTX_AGENT_NAME = agentName
  }

  createPtySession({
    terminalId,
    agentSessionId: session?.id ?? `plain-${terminalId}`,
    cwd,
    env,
    cols: typeof body.cols === 'number' ? body.cols : undefined,
    rows: typeof body.rows === 'number' ? body.rows : undefined,
  })

  // Bootstrap sequence
  setTimeout(() => {
    if (agent) {
      // Agent terminal: set prompt, show banner, launch agent CLI
      writeToPty(terminalId, `export PS1="\\033[35m${agentName}\\033[0m \\033[34m\\w\\033[0m $ "\n`)
      writeToPty(terminalId, 'echo "\\033[35m═══ OpenContext Agent Terminal ═══\\033[0m"\n')
      writeToPty(terminalId, `echo "Agent: ${agentName}"\n`)
      if (task) {
        writeToPty(terminalId, `echo "Task: ${task.title}"\n`)
      }
      writeToPty(terminalId, 'echo ""\n')

      // Launch agent CLI if runner configured
      const systemPrompt = buildSystemPrompt(agentName)
      const launchCmd = buildLaunchCommand(agent.runnerCommand, agent.runnerArgs, systemPrompt)
      if (launchCmd) {
        // Small delay to let the banner print
        setTimeout(() => {
          writeToPty(terminalId, `${launchCmd}\n`)
        }, 500)
      }
    } else {
      // Plain terminal: just a nice prompt
      writeToPty(terminalId, 'export PS1="\\033[36mctx\\033[0m \\033[34m\\w\\033[0m $ "\n')
      writeToPty(terminalId, 'echo "\\033[36m═══ OpenContext Terminal ═══\\033[0m"\n')
      writeToPty(terminalId, 'echo ""\n')
    }
  }, 300)

  // Link terminal to agent session
  if (session) {
    try {
      await prisma.agentSession.update({
        where: { id: session.id },
        data: { terminalId },
      })
    } catch (error) {
      destroyPtySession(terminalId)
      throw error
    }
  }

  return {
    terminalId,
    agentSessionId: session?.id ?? null,
    agentName,
    taskTitle: task?.title ?? null,
    taskId: task?.id ?? null,
    isPlainTerminal: !agent,
    reused: false,
  }
})
