import { randomUUID } from 'node:crypto'
import * as pty from 'node-pty'
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

function spawnWithFallback(opts: {
  cwd: string
  env: Record<string, string>
  cols: number
  rows: number
}) {
  const shells = process.platform === 'win32'
    ? ['powershell.exe']
    : ['zsh', 'bash']

  let lastError: unknown

  for (const shell of shells) {
    try {
      return pty.spawn(shell, [], {
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

export function createPtySession(opts: {
  terminalId: string
  agentSessionId: string
  cwd: string
  env: Record<string, string>
  cols?: number
  rows?: number
}): PtySession {
  const terminalId = opts.terminalId?.trim() || generateTerminalId()

  destroyPtySession(terminalId)

  const spawned = spawnWithFallback({
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

  spawned.onExit(() => {
    sessions.delete(terminalId)

    void markSessionTerminated(session.agentSessionId).catch((error) => {
      console.error('[PTY] Failed to mark session terminated on exit:', error)
    })
  })

  return session
}

export function getPtySession(terminalId: string): PtySession | undefined {
  return sessions.get(terminalId)
}

export function destroyPtySession(terminalId: string): void {
  const session = sessions.get(terminalId)
  if (!session) return

  sessions.delete(terminalId)

  try {
    session.pty.kill()
  } catch (error) {
    console.warn('[PTY] Failed to kill PTY:', error)
  }
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
