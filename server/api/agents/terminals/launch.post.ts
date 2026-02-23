import { requireUser, requireWorkspaceMember } from '../../../utils/auth'
import { createPtySession, destroyPtySession, generateTerminalId, getPtySession, writeToPty } from '../../../utils/ptyManager'
import { prisma } from '../../../utils/prisma'
import { resolveRunnerCommand } from '../../../utils/agentRunner'

function toStringEnv(env: NodeJS.ProcessEnv) {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') normalized[key] = value
  }
  return normalized
}

const SYSTEM_PROMPT_BASE = `You are {{agentName}}, an AI agent working in OpenContext. You have a CLI tool called 'ctx' on your PATH.

Key commands: ctx help, ctx tasks, ctx task <id>, ctx checkout <id>, ctx comment [id] <text>, ctx submit [id], ctx status, ctx catchup
Note: submit and comment infer the task from your active session if you omit the task ID.
Only work on tasks assigned to you. If ctx task <id> returns 'not found', the task belongs to another agent.`

const PROMPT_GENERAL = `

You were launched from the terminals view with no specific task assigned.

Workflow:
1. Run: ctx catchup -- to orient yourself, see what's going on and what needs attention
2. Present the user with a summary of what you found and suggest 2-3 tasks you could work on. Ask what they'd like you to start with.
3. Once the user picks a task: run ctx checkout <task-id> to begin
4. Do the work (edit files, run tests, etc.)
5. Run: ctx comment "description of what you did" -- to log progress
6. Run: ctx submit -- to submit for human review

Wait for the user to tell you what to work on before checking out a task.`

const PROMPT_WITH_TASK = `

You were launched to work on a specific task: "{{taskTitle}}" (ID: {{taskId}}).

Workflow:
1. Run: ctx catchup -- to orient yourself with the big picture first
2. Then run: ctx checkout {{taskId}} -- to start working on your assigned task
3. Read the task details and any comments for context
4. Do the work (edit files, run tests, etc.)
5. Run: ctx comment "description of what you did" -- to log progress
6. Run: ctx submit -- to submit for human review

Start by orienting with catchup, then focus on your assigned task.`

function buildSystemPrompt(agentName: string, task?: { id: string; title: string } | null): string {
  let prompt = SYSTEM_PROMPT_BASE
  if (task) {
    prompt += PROMPT_WITH_TASK
      .replace(/\{\{taskTitle\}\}/g, task.title)
      .replace(/\{\{taskId\}\}/g, task.id)
  } else {
    prompt += PROMPT_GENERAL
  }
  return prompt.replace(/\{\{agentName\}\}/g, agentName)
}

function buildLaunchCommand(runner: string | null, args: string | null, systemPrompt: string): string | null {
  if (!runner) return null // plain terminal, no agent CLI

  const parts = [runner]

  // Add extra args first
  if (args?.trim()) {
    parts.push(args.trim())
  }

  // Add system prompt as initial prompt/instruction based on runner
  // Codex: pass as the prompt argument (no --system-prompt flag)
  // Claude: has --system-prompt
  // Aider: pass as --message
  const singleLinePrompt = systemPrompt.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

  if (runner === 'codex') {
    // Codex: workspace-write sandbox with network access for ctx CLI API calls
    parts.push('--sandbox', 'workspace-write', '-c', "'sandbox_permissions=[\"network\"]'")
    // Codex takes prompt as positional arg, wrap in single quotes
    const escaped = singleLinePrompt.replace(/'/g, "'\\''")
    parts.push(`'${escaped}'`)
  } else if (runner === 'claude') {
    // Claude Code: --dangerously-skip-permissions for non-interactive agent use
    // System prompt via --append-system-prompt (appends to Claude Code's default)
    parts.push('--dangerously-skip-permissions')
    const escaped = singleLinePrompt.replace(/'/g, "'\\''")
    parts.push('--append-system-prompt', `'${escaped}'`)
  } else if (runner === 'aider') {
    const escaped = singleLinePrompt.replace(/'/g, "'\\''")
    parts.push('--message', `'${escaped}'`)
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
    agentProvider: string | null
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
        agentProvider: true,
        runnerCommand: true,
        runnerArgs: true,
        workspaceMembers: {
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
      agentProvider: agentUser.agentProvider,
      runnerCommand: agentUser.runnerCommand,
      runnerArgs: agentUser.runnerArgs,
      workspaceId: agentUser.workspaceMembers[0]?.workspaceId ?? null,
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
    PATH: `${cwd}/cli/bin:${process.env.PATH ?? ''}`,
    TERM: 'xterm-256color',
  }

  // Add agent-specific env vars
  if (agent) {
    if (agent.apiToken) env.CTX_TOKEN = agent.apiToken
    env.CTX_URL = origin
    env.CTX_BASE_URL = origin
    env.CTX_AGENT_SESSION = session?.id ?? ''
    env.CTX_AGENT_NAME = agentName
  }

  await createPtySession({
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
      // Agent terminal: make ctx available, set prompt, show banner, launch agent CLI
      writeToPty(terminalId, `export PATH="${cwd}/cli/bin:$PATH"\n`)
      writeToPty(terminalId, `alias ctx="node ${cwd}/cli/bin/ctx.mjs"\n`)
      writeToPty(terminalId, `export PS1=$'\\e[35m${agentName}\\e[0m \\e[34m%~\\e[0m $ '\n`)
      writeToPty(terminalId, `echo $'\\e[35m═══ OpenContext Agent Terminal ═══\\e[0m'\n`)
      writeToPty(terminalId, `echo "Agent: ${agentName}"\n`)
      if (task) {
        writeToPty(terminalId, `echo "Task: ${task.title} (${task.id})"\n`)
      } else {
        writeToPty(terminalId, `echo "Mode: General — run catchup to orient"\n`)
      }
      writeToPty(terminalId, 'echo ""\n')

      // Launch agent CLI if runner configured
      const systemPrompt = buildSystemPrompt(agentName, task ? { id: task.id, title: task.title } : null)
      const runner = resolveRunnerCommand(agent.runnerCommand, agent.agentProvider)
      const launchCmd = buildLaunchCommand(runner, agent.runnerArgs, systemPrompt)
      if (launchCmd) {
        // Small delay to let the banner print
        setTimeout(() => {
          writeToPty(terminalId, `${launchCmd}\n`)
        }, 500)
      } else {
        writeToPty(terminalId, `echo "No runner configured for provider '${agent.agentProvider ?? 'unknown'}'"\n`)
      }
    } else {
      // Plain terminal: add ctx CLI to PATH, nice prompt
      writeToPty(terminalId, `export PATH="${cwd}/cli/bin:$PATH"\n`)
      writeToPty(terminalId, `export PS1=$'\\e[36mctx\\e[0m \\e[34m%~\\e[0m $ '\n`)
      writeToPty(terminalId, `echo $'\\e[36m═══ OpenContext Terminal ═══\\e[0m'\n`)
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
