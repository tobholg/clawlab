import { randomUUID } from 'node:crypto'
// Lazy-load node-pty to avoid import-time crashes
let pty: typeof import('node-pty') | null = null
async function getPty() {
  if (!pty) {
    pty = await import('node-pty')
  }
  return pty
}
import { prisma } from './prisma'

const MAX_BUFFER_LINES = 1000
const DEFAULT_COLS = 120
const DEFAULT_ROWS = 30

export interface PtySession {
  id: string
  pty: pty.IPty
  buffer: string[]
  agentSessionId: string
  pendingLine: string
}

const sessions = new Map<string, PtySession>()

function cuid() {
  const time = Date.now().toString(36)
  const rand = randomUUID().replace(/-/g, '').slice(0, 20)
  return `c${time}${rand}`
}

export function generateTerminalId() {
  return cuid()
}

async function spawnWithFallback(opts: {
  cwd: string
  env: Record<string, string>
  cols: number
  rows: number
}) {
  const nodePty = await getPty()
  const shells = process.platform === 'win32'
    ? ['powershell.exe']
    : ['zsh', 'bash']

  let lastError: unknown

  for (const shell of shells) {
    try {
      return nodePty.spawn(shell, [], {
        name: 'xterm-256color',
        cwd: opts.cwd,
        env: opts.env,
        cols: opts.cols,
        rows: opts.rows,
      })
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to spawn shell')
}

function appendToBuffer(session: PtySession, data: string) {
  const combined = `${session.pendingLine}${data}`
  const lines = combined.split(/\r?\n/)

  session.pendingLine = lines.pop() ?? ''

  if (lines.length > 0) {
    session.buffer.push(...lines)

    if (session.buffer.length > MAX_BUFFER_LINES) {
      session.buffer.splice(0, session.buffer.length - MAX_BUFFER_LINES)
    }
  }
}

function markSessionTerminated(agentSessionId: string) {
  return prisma.agentSession.updateMany({
    where: { id: agentSessionId },
    data: {
      status: 'TERMINATED',
      completedAt: new Date(),
    },
  })
}

export async function createPtySession(opts: {
  terminalId: string
  agentSessionId: string
  cwd: string
  env: Record<string, string>
  cols?: number
  rows?: number
}): PtySession {
  const terminalId = opts.terminalId?.trim() || generateTerminalId()

  destroyPtySession(terminalId)

  const spawned = await spawnWithFallback({
    cwd: opts.cwd,
    env: opts.env,
    cols: opts.cols ?? DEFAULT_COLS,
    rows: opts.rows ?? DEFAULT_ROWS,
  })

  const session: PtySession = {
    id: terminalId,
    pty: spawned,
    buffer: [],
    agentSessionId: opts.agentSessionId,
    pendingLine: '',
  }

  sessions.set(terminalId, session)

  spawned.onData((data) => {
    appendToBuffer(session, data)
  })

  // NOTE: We intentionally do NOT register spawned.onExit().
  // node-pty 1.0.0 has a fatal V8 HandleScope race in pty_after_waitpid
  // that crashes the entire process. Instead, we detect exit via onData
  // stopping (the WebSocket close handler cleans up) and explicit destroy calls.

  return session
}

export function getPtySession(terminalId: string): PtySession | undefined {
  return sessions.get(terminalId)
}

export function destroyPtySession(terminalId: string): void {
  const session = sessions.get(terminalId)
  if (!session) return

  sessions.delete(terminalId)

  // Graceful shutdown only — never call pty.kill().
  // node-pty 1.0.0 has a fatal V8 HandleScope race in pty_after_waitpid
  // that crashes the entire Node process. Sending 'exit' + SIGHUP is enough.
  try {
    session.pty.write('\x03\n')  // Ctrl+C first to break any running command
    session.pty.write('exit\n')
  } catch {}

  // Send SIGHUP via process.kill as a fallback (bypasses node-pty's broken handler)
  setTimeout(() => {
    try {
      process.kill(session.pty.pid, 'SIGHUP')
    } catch {
      // Already dead — fine
    }
  }, 1000)

  void markSessionTerminated(session.agentSessionId).catch(() => {})
}

export function writeToPty(terminalId: string, data: string): void {
  const session = sessions.get(terminalId)
  if (!session) return

  session.pty.write(data)
}

export function resizePty(terminalId: string, cols: number, rows: number): void {
  const session = sessions.get(terminalId)
  if (!session) return

  session.pty.resize(cols, rows)
}

export function listPtySessions(): Array<{ terminalId: string; agentSessionId: string }> {
  return [...sessions.values()].map((session) => ({
    terminalId: session.id,
    agentSessionId: session.agentSessionId,
  }))
}
