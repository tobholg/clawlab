import { randomUUID } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { prisma } from './prisma'

const MAX_BUFFER_LINES = 1000
const DEFAULT_COLS = 120
const DEFAULT_ROWS = 30

export interface PtySession {
  id: string
  process: ChildProcess
  pid: number
  buffer: string[]
  agentSessionId: string
  pendingLine: string
  cols: number
  rows: number
  exited: boolean
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

function findShell(): string {
  const shells = process.platform === 'win32'
    ? ['powershell.exe']
    : ['/bin/zsh', '/bin/bash', '/bin/sh']
  // On Unix, these paths are standard — just return the first
  return shells[0]
}

export async function createPtySession(opts: {
  terminalId: string
  agentSessionId: string
  cwd: string
  env: Record<string, string>
  cols?: number
  rows?: number
}): Promise<PtySession> {
  const terminalId = opts.terminalId?.trim() || generateTerminalId()
  const cols = opts.cols ?? DEFAULT_COLS
  const rows = opts.rows ?? DEFAULT_ROWS

  destroyPtySession(terminalId)

  const shell = findShell()

  // Use `script` to allocate a real PTY without node-pty.
  // macOS: script -q /dev/null <shell>
  // Linux: script -qc <shell> /dev/null
  const isDarwin = process.platform === 'darwin'
  const args = isDarwin
    ? ['-q', '/dev/null', shell]
    : ['-qc', shell, '/dev/null']

  const child = spawn('script', args, {
    cwd: opts.cwd,
    env: {
      ...opts.env,
      TERM: 'xterm-256color',
      COLUMNS: String(cols),
      LINES: String(rows),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  if (!child.pid) {
    throw new Error('Failed to spawn PTY process')
  }

  const session: PtySession = {
    id: terminalId,
    process: child,
    pid: child.pid,
    buffer: [],
    agentSessionId: opts.agentSessionId,
    pendingLine: '',
    cols,
    rows,
    exited: false,
  }

  sessions.set(terminalId, session)
  console.log(`[PTY] Session created: ${terminalId}, pid: ${child.pid}`)

  child.stdout?.on('data', (data: Buffer) => {
    appendToBuffer(session, data.toString())
  })

  child.stderr?.on('data', (data: Buffer) => {
    appendToBuffer(session, data.toString())
  })

  child.on('exit', () => {
    session.exited = true
    sessions.delete(terminalId)
    void markSessionTerminated(session.agentSessionId).catch(() => {})
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

  if (!session.exited) {
    try {
      session.process.stdin?.write('\x03\n')  // Ctrl+C
      session.process.stdin?.write('exit\n')
    } catch {}

    // Force kill after 1s if still alive
    setTimeout(() => {
      if (!session.exited) {
        try { process.kill(session.pid, 'SIGKILL') } catch {}
      }
    }, 1000)
  }

  void markSessionTerminated(session.agentSessionId).catch(() => {})
}

export function writeToPty(terminalId: string, data: string): void {
  const session = sessions.get(terminalId)
  if (!session || session.exited) return

  session.process.stdin?.write(data)
}

export function resizePty(terminalId: string, cols: number, rows: number): void {
  const session = sessions.get(terminalId)
  if (!session || session.exited) return

  session.cols = cols
  session.rows = rows

  // Send SIGWINCH to the child process to notify of resize
  // Also set stty size via the shell
  try {
    session.process.stdin?.write(`stty cols ${cols} rows ${rows}\n`)
  } catch {}
}

export function listPtySessions(): Array<{ terminalId: string; agentSessionId: string }> {
  return [...sessions.values()].map((session) => ({
    terminalId: session.id,
    agentSessionId: session.agentSessionId,
  }))
}
