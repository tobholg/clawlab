import { randomUUID } from 'node:crypto'
import { fork, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'
import { prisma } from './prisma'

const MAX_BUFFER_LINES = 1000
const DEFAULT_COLS = 120
const DEFAULT_ROWS = 30

export interface PtySession {
  id: string
  pid: number
  buffer: string[]
  agentSessionId: string
  scopeKey: string
  pendingLine: string
  exited: boolean
  dataListeners: Set<(data: string) => void>
  exitListeners: Set<(code: number) => void>
}

const sessions = new Map<string, PtySession>()

// ── Worker process management ───────────────────────────────────────────────

let worker: ChildProcess | null = null
let workerReady = false
const pendingSpawns = new Map<string, { resolve: (s: PtySession) => void; reject: (e: Error) => void }>()

function getWorkerPath(): string {
  // In dev, the file is at server/utils/pty-worker.mjs
  // We need the source path, not the built path
  return resolve(process.cwd(), 'server/utils/pty-worker.mjs')
}

function ensureWorker(): ChildProcess {
  if (worker && !worker.killed) return worker

  console.log('[PTY] Spawning worker process...')
  worker = fork(getWorkerPath(), [], {
    serialization: 'json',
    stdio: ['pipe', 'inherit', 'inherit', 'ipc'],
  })

  workerReady = false

  worker.on('message', (msg: any) => {
    if (msg.type === 'ready') {
      workerReady = true
      console.log('[PTY] Worker ready')
      return
    }

    if (msg.type === 'spawned') {
      const session = sessions.get(msg.id)
      const pending = pendingSpawns.get(msg.id)
      if (session) {
        session.pid = msg.pid
      }
      if (pending) {
        pendingSpawns.delete(msg.id)
        if (session) pending.resolve(session)
        else pending.reject(new Error('Session not found after spawn'))
      }
      return
    }

    if (msg.type === 'error') {
      const pending = pendingSpawns.get(msg.id)
      if (pending) {
        pendingSpawns.delete(msg.id)
        pending.reject(new Error(msg.error))
      }
      return
    }

    if (msg.type === 'data') {
      const session = sessions.get(msg.id)
      if (session) {
        appendToBuffer(session, msg.data)
        for (const listener of session.dataListeners) {
          listener(msg.data)
        }
      }
      return
    }

    if (msg.type === 'exit') {
      const session = sessions.get(msg.id)
      if (session) {
        session.exited = true
        sessions.delete(msg.id)
        for (const listener of session.exitListeners) {
          listener(msg.code ?? 0)
        }
        void markSessionTerminated(session.agentSessionId).catch(() => {})
      }
      return
    }
  })

  worker.on('exit', (code, signal) => {
    console.log(`[PTY] Worker exited: code=${code}, signal=${signal}`)
    worker = null
    workerReady = false

    // Mark all sessions as exited
    for (const [id, session] of sessions) {
      session.exited = true
      for (const listener of session.exitListeners) {
        listener(-1)
      }
      void markSessionTerminated(session.agentSessionId).catch(() => {})
    }
    sessions.clear()
    pendingSpawns.clear()
  })

  return worker
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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

// ── Public API ──────────────────────────────────────────────────────────────

export async function createPtySession(opts: {
  terminalId: string
  agentSessionId: string
  scopeKey?: string
  cwd: string
  env: Record<string, string>
  cols?: number
  rows?: number
}): Promise<PtySession> {
  const terminalId = opts.terminalId?.trim() || generateTerminalId()

  destroyPtySession(terminalId)

  const session: PtySession = {
    id: terminalId,
    pid: 0,
    buffer: [],
    agentSessionId: opts.agentSessionId,
    scopeKey: opts.scopeKey ?? 'global',
    pendingLine: '',
    exited: false,
    dataListeners: new Set(),
    exitListeners: new Set(),
  }

  sessions.set(terminalId, session)

  const w = ensureWorker()

  return new Promise<PtySession>((resolve, reject) => {
    pendingSpawns.set(terminalId, { resolve, reject })

    w.send({
      type: 'spawn',
      id: terminalId,
      cwd: opts.cwd,
      env: opts.env,
      cols: opts.cols ?? DEFAULT_COLS,
      rows: opts.rows ?? DEFAULT_ROWS,
    })

    // Timeout
    setTimeout(() => {
      if (pendingSpawns.has(terminalId)) {
        pendingSpawns.delete(terminalId)
        sessions.delete(terminalId)
        reject(new Error('PTY spawn timed out'))
      }
    }, 5000)
  })
}

export function getPtySession(terminalId: string): PtySession | undefined {
  return sessions.get(terminalId)
}

export function destroyPtySession(terminalId: string): void {
  const session = sessions.get(terminalId)
  if (!session) return

  sessions.delete(terminalId)

  if (!session.exited && worker && !worker.killed) {
    worker.send({ type: 'kill', id: terminalId })
  }

  void markSessionTerminated(session.agentSessionId).catch(() => {})
}

export function writeToPty(terminalId: string, data: string): void {
  const session = sessions.get(terminalId)
  if (!session || session.exited) return

  if (worker && !worker.killed) {
    worker.send({ type: 'write', id: terminalId, data })
  }
}

export function resizePty(terminalId: string, cols: number, rows: number): void {
  const session = sessions.get(terminalId)
  if (!session || session.exited) return

  if (worker && !worker.killed) {
    worker.send({ type: 'resize', id: terminalId, cols, rows })
  }
}

export function listPtySessions(): Array<{ terminalId: string; agentSessionId: string; scopeKey: string }> {
  return [...sessions.values()].map((s) => ({
    terminalId: s.id,
    agentSessionId: s.agentSessionId,
    scopeKey: s.scopeKey,
  }))
}
