#!/usr/bin/env node

// Context CLI — thin wrapper around the Context Agent API
// Auth: CTX_TOKEN + CTX_URL env vars, or ~/.config/context/config.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { basename, join } from 'node:path'
import { homedir } from 'node:os'

// ── Config ──────────────────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), '.config', 'context')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveConfig(config) {
  mkdirSync(CONFIG_DIR, { recursive: true })
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n')
}

const config = loadConfig()
const TOKEN = process.env.CTX_TOKEN || config.token
const BASE = (process.env.CTX_URL || config.url || 'http://localhost:3001').replace(/\/+$/, '')

// ── HTTP ────────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`

  const opts = { method, headers, signal: AbortSignal.timeout(15000) }
  if (body) opts.body = JSON.stringify(body)

  let res
  try {
    res = await fetch(`${BASE}${path}`, opts)
  } catch (e) {
    const cause = e?.cause?.code || e?.code || ''
    if (cause === 'ECONNREFUSED') throw new Error(`Cannot connect to ${BASE} - is the server running?`)
    if (e.name === 'TimeoutError') throw new Error(`Request timed out: ${method} ${path}`)
    throw new Error(`Network error: ${e.message}${cause ? ` (${cause})` : ''}`)
  }
  const text = await res.text()

  let data
  try { data = JSON.parse(text) } catch { data = text }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

async function postMultipart(path, formData) {
  const headers = {}
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`

  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: formData,
  })
  const text = await res.text()

  let data
  try { data = JSON.parse(text) } catch { data = text }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data
}

const get = (path) => api('GET', path)
const post = (path, body) => api('POST', path, body)
const patch = (path, body) => api('PATCH', path, body)
const del = (path) => api('DELETE', path)

// ── Output helpers ──────────────────────────────────────────────────────────

// JSON_OUT is set after arg parsing in main block; default false for module load
let JSON_OUT = false

function print(text) { console.log(text) }

function json(data) { console.log(JSON.stringify(data, null, 2)) }

function table(rows, columns) {
  if (JSON_OUT) return json(rows)
  if (!rows.length) return print('  (none)')

  const widths = columns.map(c =>
    Math.max(c.label.length, ...rows.map(r => String(c.get(r) ?? '').length))
  )

  const header = columns.map((c, i) => c.label.padEnd(widths[i])).join('  ')
  const sep = columns.map((_, i) => '─'.repeat(widths[i])).join('──')

  print(`  ${header}`)
  print(`  ${sep}`)
  rows.forEach(r => {
    const line = columns.map((c, i) => String(c.get(r) ?? '').padEnd(widths[i])).join('  ')
    print(`  ${line}`)
  })
}

function priorityIcon(p) {
  return { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '⚪' }[p] || '·'
}

function statusIcon(s) {
  return { TODO: '○', IN_PROGRESS: '◐', BLOCKED: '✕', PAUSED: '⏸', DONE: '●' }[s] || '?'
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = Number(bytes) || 0
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return unitIndex === 0 ? `${value} ${units[unitIndex]}` : `${value.toFixed(1)} ${units[unitIndex]}`
}

function formatDurationMs(durationMs) {
  const safeDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0
  const totalMinutes = Math.floor(safeDuration / (60 * 1000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }

  return `${minutes}m`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireToken() {
  if (!TOKEN) {
    console.error('Error: No API token. Set CTX_TOKEN or run: ctx login')
    process.exit(1)
  }
}

// Resolve a short ID (last 8 chars) to a full ID by searching tasks
async function resolveId(idOrShort) {
  // If it looks like a full CUID (25+ chars), use as-is
  if (idOrShort.length > 16) return idOrShort

  // Fetch all tasks and find by suffix match
  const tasks = await get('/api/agents/tasks')
  const match = tasks.find(t => t.id.endsWith(idOrShort))
  if (match) return match.id

  // Also check subtasks by fetching detail for each task
  for (const task of tasks) {
    try {
      const detail = await get(`/api/agents/tasks/${task.id}`)
      if (detail.subtasks) {
        const sub = detail.subtasks.find(s => s.id.endsWith(idOrShort))
        if (sub) return sub.id
      }
    } catch { /* skip */ }
  }

  // Also try project IDs
  const projects = await get('/api/agents/projects')
  const projMatch = projects.find(p => p.id.endsWith(idOrShort))
  if (projMatch) return projMatch.id

  // Fall back to using it as-is (will 404 if wrong)
  return idOrShort
}

async function resolveDocId(taskId, idOrShort) {
  if (idOrShort.length > 16) return idOrShort
  const docs = await get(`/api/agents/tasks/${taskId}/docs`)
  const match = docs.find(d => d.id.endsWith(idOrShort))
  if (match) return match.id
  return idOrShort
}

async function resolveChannelId(idOrShort) {
  if (idOrShort.length > 16) return idOrShort

  const payload = await get('/api/agents/channels')
  const channels = Array.isArray(payload) ? payload : (payload.channels || [])
  const match = channels.find(c => c.id.endsWith(idOrShort))
  return match ? match.id : idOrShort
}

function parseSinceFlag(value) {
  if (!value || typeof value !== 'string') return null

  const directDate = new Date(value)
  if (!Number.isNaN(directDate.getTime())) {
    return directDate.toISOString()
  }

  const relative = value.trim().toLowerCase().match(/^(\d+)([smhdw])$/)
  if (!relative) {
    throw new Error('Invalid --since format. Use ISO datetime or relative values like 30m, 2h, 7d')
  }

  const amount = parseInt(relative[1], 10)
  const unit = relative[2]

  const unitMs = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  }[unit]

  return new Date(Date.now() - amount * unitMs).toISOString()
}

function formatChannelMessageContent(message) {
  const mentionMap = new Map((message.mentions || []).map(m => [m.userId, m.user?.name || 'unknown']))
  return String(message.content || '')
    .replace(/<@([a-zA-Z0-9_-]+)>/g, (_, userId) => `@${mentionMap.get(userId) || 'unknown'}`)
    .replace(/\s+/g, ' ')
    .trim()
}

function readStdinOrFile(arg) {
  if (!arg || arg === '-') {
    // Read from stdin
    return readFileSync(0, 'utf-8')
  }
  if (existsSync(arg)) {
    return readFileSync(arg, 'utf-8')
  }
  return arg
}

// ── Commands ────────────────────────────────────────────────────────────────

const commands = {}

// ── login ───────────────────────────────────────────────────────────────────

commands.login = {
  usage: 'ctx login [--url URL] [--token TOKEN]',
  desc: 'Configure authentication',
  async run(args, flags) {
    const url = flags.get('--url') || BASE
    const token = flags.get('--token')

    if (!token) {
      console.error('Usage: ctx login --token ctx_xxx [--url http://localhost:3001]')
      process.exit(1)
    }

    saveConfig({ url, token })
    print(`✓ Config saved to ${CONFIG_FILE}`)

    // Verify
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const res = await fetch(`${url}/api/agents/me`, { headers })
      if (res.ok) {
        const me = await res.json()
        print(`✓ Authenticated as ${me.name} (${me.agentProvider})`)
      } else {
        print('⚠ Token saved but verification failed — check your token and URL')
      }
    } catch (e) {
      print(`⚠ Token saved but could not reach ${url} — is the server running?`)
    }
  },
}

// ── api (discovery) ─────────────────────────────────────────────────────────

commands.api = {
  usage: 'ctx api [endpoint-id]',
  desc: 'Discover available API endpoints',
  async run(args, flags) {
    const endpointId = args[0]
    if (endpointId) {
      const data = await get(`/api/agents/index/${endpointId}`)
      if (JSON_OUT) return json(data)
      print(`\n  ${data.method} ${data.path}`)
      print(`  ${data.description}`)
      print(`  Auth: ${data.auth ? 'required' : 'none'}\n`)
      if (data.params) {
        print('  Parameters:')
        json(data.params)
      }
      if (data.response) {
        print('\n  Response:')
        json(data.response)
      }
    } else {
      const data = await get('/api/agents/')
      if (JSON_OUT) return json(data)
      print(`\n  ${data.name} v${data.version}\n`)
      data.endpoints.forEach(e => {
        print(`  ${e.method.padEnd(6)} ${e.path}`)
        print(`         ${e.description}\n`)
      })
    }
  },
}

// ── me ──────────────────────────────────────────────────────────────────────

commands.me = {
  usage: 'ctx me',
  desc: 'Show agent profile',
  async run() {
    requireToken()
    const data = await get('/api/agents/me')
    if (JSON_OUT) return json(data)
    print(`\n  ${data.name} (${data.agentProvider})`)
    print(`  Projects: ${data.projects}`)
    print(`  Tasks: plan=${data.tasks.plan} execute=${data.tasks.execute} review=${data.tasks.review}\n`)
  },
}

// ── catchup ─────────────────────────────────────────────────────────────────

commands.catchup = {
  usage: 'ctx catchup [--since 4h]',
  desc: 'Show everything you missed: tasks, mentions, comments, thread replies',
  async run(args, flags) {
    requireToken()

    const since = flags.get('--since') || '4h'
    const data = await get(`/api/agents/catchup?since=${encodeURIComponent(since)}`)
    if (JSON_OUT) return json(data)

    const s = data.summary
    const total = s.newTaskCount + s.updatedTaskCount + s.commentCount + s.mentionCount + s.threadReplyCount

    print(`\n  Catch-up since ${new Date(data.since).toLocaleString()}`)
    print(`  ─────────────────────────────────`)

    if (total === 0) {
      print(`  Nothing new. All caught up! ✓\n`)
      return
    }

    // Action required: tasks with agentMode set (from both new and updated)
    const allTasks = [...(data.tasks.assigned || []), ...(data.tasks.updated || [])]
    const actionTasks = allTasks.filter(t => t.agentMode)
    let currentSession = null
    try {
      currentSession = await get('/api/agents/sessions?current=true')
    } catch { /* optional enrichment */ }

    const currentTaskId = currentSession?.task?.id || currentSession?.itemId || null
    const currentCheckedOutAt = currentSession?.checkedOutAt || null

    if (actionTasks.length > 0) {
      print(`\n  🎯 Action required (${actionTasks.length})`)
      const modeHints = {
        plan: 'Create a plan document and submit for review',
        execute: 'Execute the approved plan',
        review: 'Submit your work for human review',
      }
      for (const t of actionTasks) {
        const mode = (t.agentMode || '').toLowerCase()
        const modeLabel = mode.toUpperCase()
        const hint = modeHints[mode] || `Mode: ${modeLabel}`
        const isCurrentTask = currentTaskId === t.id
        print(``)
        print(`     ⚡ ${modeLabel}  ${t.title}  (${t.id.slice(-8)})  ${t.progress ?? 0}%`)
        if (isCurrentTask) {
          const elapsedMs = currentCheckedOutAt ? Date.now() - new Date(currentCheckedOutAt).getTime() : 0
          print(`       → Currently checked out (${formatDurationMs(elapsedMs)})`)
        } else {
          print(`       → ${hint}`)
        }

        // Fetch subtasks for context
        try {
          const detail = await get(`/api/agents/tasks/${t.id}`)
          const subs = detail.subtasks || detail.children || []
          if (subs.length > 0) {
            const done = subs.filter(s => s.status === 'DONE' || s.status === 'done').length
            const inProg = subs.filter(s => s.status === 'IN_PROGRESS' || s.status === 'in_progress').length
            print(`       ${done}/${subs.length} done${inProg ? `, ${inProg} in progress` : ''}`)
            for (const s of subs) {
              const icon = (s.status === 'DONE' || s.status === 'done') ? '✓' : (s.status === 'IN_PROGRESS' || s.status === 'in_progress') ? '◐' : '○'
              const st = (s.status || '').toUpperCase().padEnd(12)
              print(`         ${icon} ${st} ${s.title}`)
            }
          }
        } catch { /* skip if fetch fails */ }

        print(`       $ ctx task ${t.id.slice(-8)}          # view details`)
        if (mode === 'plan') {
          print(`       $ ctx doc ${t.id.slice(-8)} --create  # start your plan`)
        }
      }
    }

    // Filter action tasks out of regular lists to avoid duplication
    const actionIds = new Set(actionTasks.map(t => t.id))

    const newTasks = (data.tasks.assigned || []).filter(t => !actionIds.has(t.id))
    if (newTasks.length > 0) {
      print(`\n  📋 New tasks (${newTasks.length})`)
      for (const t of newTasks) {
        print(`     ${t.status.padEnd(12)} ${t.title}  (${t.id.slice(-8)})`)
      }
    }

    const updatedTasks = (data.tasks.updated || []).filter(t => !actionIds.has(t.id))
    if (updatedTasks.length > 0) {
      print(`\n  🔄 Updated tasks (${updatedTasks.length})`)
      for (const t of updatedTasks) {
        print(`     ${t.status.padEnd(12)} ${t.title}  (${t.id.slice(-8)})`)
      }
    }

    if (s.commentCount > 0) {
      print(`\n  💬 New comments (${s.commentCount})`)
      for (const c of data.tasks.commented) {
        const preview = c.content.replace(/\s+/g, ' ').slice(0, 80)
        print(`     ${c.author.name} on "${c.task.title}": ${preview}`)
      }
    }

    if (s.mentionCount > 0) {
      print(`\n  📣 Mentions (${s.mentionCount})`)
      for (const m of data.channels.mentions) {
        const preview = m.content.replace(/<@[^>]+>/g, '@someone').replace(/\s+/g, ' ').slice(0, 80)
        print(`     #${m.channelName} — ${m.author.name}: ${preview}`)
      }
    }

    if (s.threadReplyCount > 0) {
      print(`\n  🧵 Thread replies (${s.threadReplyCount})`)
      for (const r of data.channels.threadReplies) {
        const preview = r.content.replace(/<@[^>]+>/g, '@someone').replace(/\s+/g, ' ').slice(0, 80)
        print(`     #${r.channelName} — ${r.author.name}: ${preview}`)
      }
    }

    print('')
  },
}

// ── checkout ───────────────────────────────────────────────────────────────

commands.checkout = {
  usage: 'ctx checkout <task-id>',
  desc: 'Start a tracked work session on a task',
  async run(args) {
    requireToken()
    if (!args[0]) return die('Usage: ctx checkout <task-id>')
    const taskId = await resolveId(args[0])

    const data = await post('/api/agents/checkout', { taskId })
    if (JSON_OUT) return json(data)

    const task = data.task || {}
    const subtasks = task.subtasks || []
    const done = subtasks.filter(s => s.status === 'DONE').length
    const inProgress = subtasks.filter(s => s.status === 'IN_PROGRESS').length
    const todo = Math.max(0, subtasks.length - done - inProgress)
    const planText = task.planDoc ? `${task.planDoc.title} (${task.planDoc.id.slice(-8)})` : 'None'

    print(`✓ Checked out: ${task.title}`)
    print(`  Mode:     ${task.agentMode || 'N/A'}`)
    print(`  Plan:     ${planText}`)
    print(`  Subtasks: ${subtasks.length} (${done} done, ${inProgress} in progress, ${todo} todo)`)
    print('  Duration tracking started.')
  },
}

// ── submit ─────────────────────────────────────────────────────────────────

commands.submit = {
  usage: 'ctx submit <task-id>',
  desc: 'Submit active work session for review',
  async run(args) {
    requireToken()
    if (!args[0]) return die('Usage: ctx submit <task-id>')
    const taskId = await resolveId(args[0])

    const data = await post('/api/agents/submit', { taskId })
    if (JSON_OUT) return json(data)

    const session = data.session || {}
    const task = data.task || {}
    const durationMs = Number.isFinite(session.durationMs)
      ? session.durationMs
      : session.checkedOutAt && session.completedAt
        ? new Date(session.completedAt).getTime() - new Date(session.checkedOutAt).getTime()
        : 0

    print(`✓ Submitted for review: ${task.title}`)
    print(`  Duration:  ${formatDurationMs(durationMs)}`)
    print(`  Progress:  ${task.progress}% (awaiting human approval)`)
  },
}

// ── status ─────────────────────────────────────────────────────────────────

commands.status = {
  usage: 'ctx status',
  desc: 'Show current active session status',
  async run() {
    requireToken()
    const session = await get('/api/agents/sessions?current=true')
    if (JSON_OUT) return json(session)

    if (!session) {
      print('No active session. Run `ctx checkout <task-id>` to start working.')
      return
    }

    const checkedOutAt = session.checkedOutAt ? new Date(session.checkedOutAt).getTime() : Date.now()
    const elapsed = formatDurationMs(Date.now() - checkedOutAt)
    const taskId = session.task?.id || session.itemId || ''
    const taskIdSuffix = taskId ? taskId.slice(-8) : 'unknown'

    print('')
    print(`  Agent:    ${session.agent?.name || 'Unknown'}`)
    print(`  Session:  active since ${elapsed} ago`)
    print(`  Task:     ${session.task?.title || 'Unknown task'} (${taskIdSuffix})`)
    print(`  Mode:     ${session.task?.agentMode || 'N/A'}`)
    print(`  Progress: ${session.task?.progress ?? 0}%`)
    print('')
  },
}

// ── projects ────────────────────────────────────────────────────────────────

commands.projects = {
  usage: 'ctx projects',
  desc: 'List assigned projects',
  async run() {
    requireToken()
    const data = await get('/api/agents/projects')
    if (JSON_OUT) return json(data)
    print('')
    table(data, [
      { label: 'ID', get: r => r.id.slice(-8) },
      { label: 'Title', get: r => r.title },
      { label: 'Status', get: r => r.status },
      { label: 'Progress', get: r => `${r.progress}%` },
      { label: 'Tasks', get: r => `${r.taskCount.todo}t ${r.taskCount.inProgress}p ${r.taskCount.done}d` },
    ])
    print('')
  },
}

// ── create-project ──────────────────────────────────────────────────────────

commands['create-project'] = {
  usage: 'ctx create-project <title> [--description "text"]',
  desc: 'Create a new top-level project',
  async run(args, flags) {
    requireToken()
    const title = args.join(' ')
    if (!title) return die('Usage: ctx create-project <title>')

    const body = { title }
    const desc = flags.get('--description')
    if (typeof desc === 'string') body.description = desc

    const data = await post('/api/agents/projects', body)
    if (JSON_OUT) return json(data)
    print(`✓ Project created: ${data.title} (${data.id.slice(-8)})`)
  },
}

// ── channels ────────────────────────────────────────────────────────────────

commands.channels = {
  usage: 'ctx channels [channel-id] [--since 2h] [--mentions-only] [--reply \"text\"] [--thread <message-id>] [--limit 20]',
  desc: 'List channels, read channel messages, or reply in a channel/thread',
  async run(args, flags) {
    requireToken()

    const channelArg = args[0]
    if (!channelArg) {
      const payload = await get('/api/agents/channels')
      const channels = Array.isArray(payload) ? payload : (payload.channels || [])
      if (JSON_OUT) return json(channels)

      print('')
      table(channels, [
        { label: 'ID', get: r => r.id.slice(-8) },
        { label: 'Channel', get: r => r.displayName || r.name },
        { label: 'Type', get: r => String(r.type || '').toUpperCase() },
        { label: 'Unread @', get: r => r.unreadMentions ?? 0 },
      ])
      print('')
      return
    }

    const channelId = await resolveChannelId(channelArg)
    const replyRaw = flags.get('--reply')
    const threadRaw = flags.get('--thread')

    if (flags.has('--reply')) {
      const replyArg = typeof replyRaw === 'string' ? replyRaw : '-'
      const content = readStdinOrFile(replyArg).trim()
      if (!content) {
        throw new Error('Reply content is required')
      }

      const body = { content }
      if (typeof threadRaw === 'string' && threadRaw.trim()) {
        body.parentId = threadRaw.trim()
      }

      const data = await post(`/api/agents/channels/${channelId}/messages`, body)
      if (JSON_OUT) return json(data)
      print(`✓ Sent message (${data.id.slice(-8)})`)
      return
    }

    const limitRaw = flags.get('--limit')
    let limit = 20
    if (typeof limitRaw === 'string') {
      const parsed = parseInt(limitRaw, 10)
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error('Invalid --limit value')
      }
      limit = parsed
    }

    const query = new URLSearchParams()
    query.set('limit', String(limit))

    const sinceRaw = flags.get('--since')
    if (typeof sinceRaw === 'string') {
      query.set('since', parseSinceFlag(sinceRaw))
    }

    if (flags.has('--mentions-only')) {
      query.set('mentionsMe', 'true')
    }

    const qs = query.toString()
    const data = await get(`/api/agents/channels/${channelId}/messages${qs ? `?${qs}` : ''}`)
    if (JSON_OUT) return json(data)

    const messages = data.messages || []
    print('')
    if (!messages.length) {
      print('  No messages.\n')
      return
    }

    messages.forEach((message) => {
      const stamp = new Date(message.createdAt).toLocaleString()
      const author = message.user?.name || 'Unknown'
      const suffix = message.parentId ? ' (thread)' : ''
      const content = formatChannelMessageContent(message)
      print(`  [${stamp}] ${author}${suffix}: ${content}`)
    })
    print('')
  },
}

// ── tasks ───────────────────────────────────────────────────────────────────

commands.tasks = {
  usage: 'ctx tasks [--tree] [--status STATUS]',
  desc: 'List assigned tasks (--tree for hierarchy)',
  async run(args, flags) {
    requireToken()
    const data = await get('/api/agents/tasks')
    if (JSON_OUT && !flags.has('--tree')) return json(data)

    if (flags.has('--tree')) {
      // Group tasks by parentId to find top-level ones
      const topLevel = data.filter(t => !data.some(other => other.id === t.parentId))

      // Fetch subtasks for each top-level task
      const tree = []
      for (const task of topLevel) {
        let detail
        try {
          detail = await get(`/api/agents/tasks/${task.id}`)
        } catch {
          detail = { ...task, subtasks: [] }
        }
        tree.push(detail)
      }

      if (JSON_OUT) return json(tree)
      print('')
      if (!tree.length) return print('  No tasks assigned.\n')

      tree.forEach(t => {
        print(`  ${statusIcon(t.status)} ${priorityIcon(t.priority)} ${t.title}  ${t.id.slice(-8)}${t.category ? '  [' + t.category + ']' : ''}`)
        const subs = t.subtasks || []
        subs.forEach((s, i) => {
          const isLast = i === subs.length - 1
          const prefix = isLast ? '└─' : '├─'
          print(`    ${prefix} ${statusIcon(s.status)} ${priorityIcon(s.priority || 'MEDIUM')} ${s.title}  ${s.id.slice(-8)}`)
        })
        print('')
      })
      return
    }

    print('')
    if (!data.length) return print('  No tasks assigned.\n')
    data.forEach(t => {
      print(`  ${statusIcon(t.status)} ${priorityIcon(t.priority)} ${t.title}`)
      print(`    ${t.id.slice(-8)}  ${t.status}  ${t.progress}%${t.category ? '  [' + t.category + ']' : ''}`)
      print('')
    })
  },
}

// ── task (detail / update) ──────────────────────────────────────────────────

commands.task = {
  usage: 'ctx task <id> [--status S] [--progress N] [--title T] [--desc T] [--category C] [--priority P]',
  desc: 'View or update a task',
  async run(args, flags) {
    requireToken()
    if (!args[0]) return die('Usage: ctx task <id>')
    const id = await resolveId(args[0])

    const updates = {}
    const s = flags.get('--status')
    const p = flags.get('--progress')
    const t = flags.get('--title')
    const d = flags.get('--desc')
    const c = flags.get('--category')
    const pr = flags.get('--priority')
    const ss = flags.get('--substatus') || flags.get('--sub-status')

    if (s) updates.status = s.toUpperCase()
    if (p) updates.progress = parseInt(p)
    if (t) updates.title = t
    if (d) updates.description = readStdinOrFile(d)
    if (c) updates.category = c
    if (pr) updates.priority = pr.toUpperCase()
    if (ss) updates.subStatus = ss.toLowerCase()

    if (Object.keys(updates).length) {
      const data = await patch(`/api/agents/tasks/${id}`, updates)
      if (JSON_OUT) return json(data)
      print(`✓ Updated ${id.slice(-8)}`)
      return
    }

    const data = await get(`/api/agents/tasks/${id}`)
    if (JSON_OUT) return json(data)
    print('')
    print(`  ${statusIcon(data.status)} ${data.title}`)
    print(`  ID:       ${data.id}`)
    print(`  Status:   ${data.status}${data.subStatus ? ' / ' + data.subStatus : ''}`)
    print(`  Priority: ${priorityIcon(data.priority)} ${data.priority || 'none'}`)
    print(`  Category: ${data.category || 'none'}`)
    print(`  Progress: ${data.progress}%`)
    if (data.agentMode) print(`  Mode:     ${data.agentMode}`)
    if (data.parent) print(`  Parent:   ${data.parent.title} (${data.parent.id.slice(-8)})`)
    if (data.project) print(`  Project:  ${data.project.title} (${data.project.id.slice(-8)})`)

    if (data.description) {
      print('')
      print(data.description.split('\n').map(l => '  ' + l).join('\n'))
    }

    if (data.subtasks?.length) {
      print(`\n  Subtasks (${data.subtasks.length}):`)
      data.subtasks.forEach(s => {
        print(`    ${statusIcon(s.status)} ${s.title} (${s.id.slice(-8)})`)
      })
    }

    if (data.documents?.length) {
      print(`\n  Documents (${data.documents.length}):`)
      data.documents.forEach(d => {
        print(`    📄 ${d.title} (${d.id.slice(-8)})`)
      })
    }

    if (data.comments?.length) {
      print(`\n  Comments (${data.comments.length}):`)
      data.comments.forEach(c => {
        print(`    ${c.user.name}: ${c.content.slice(0, 80)}${c.content.length > 80 ? '…' : ''}`)
      })
    }
    print('')
  },
}

// ── subtask ─────────────────────────────────────────────────────────────────

commands.subtask = {
  usage: 'ctx subtask <parent-id> <title> [--desc D] [--category C] [--priority P]',
  desc: 'Create a subtask',
  async run(args, flags) {
    requireToken()
    if (!args[0] || !args[1]) return die('Usage: ctx subtask <parent-id> <title>')
    const parentId = await resolveId(args[0])
    const title = args[1]

    const body = { title }
    const d = flags.get('--desc')
    const c = flags.get('--category')
    const p = flags.get('--priority')

    if (d) body.description = readStdinOrFile(d)
    if (c) body.category = c
    if (p) body.priority = p.toUpperCase()

    const data = await post(`/api/agents/tasks/${parentId}/subtasks`, body)
    if (JSON_OUT) return json(data)
    print(`✓ Created subtask: ${data.title} (${data.id.slice(-8)})`)
  },
}

// ── rm ──────────────────────────────────────────────────────────────────────

commands.rm = {
  usage: 'ctx rm <task-id>',
  desc: 'Delete an agent-owned subtask',
  async run(args, flags) {
    requireToken()
    if (!args[0]) return die('Usage: ctx rm <task-id>')
    const id = await resolveId(args[0])
    await del(`/api/agents/tasks/${id}`)
    print(`✓ Deleted ${id.slice(-8)}`)
  },
}

// ── comment ─────────────────────────────────────────────────────────────────

commands.comment = {
  usage: 'ctx comment <task-id> <text | file | ->',
  desc: 'Add a comment to a task',
  async run(args, flags) {
    requireToken()
    if (!args[0]) return die('Usage: ctx comment <task-id> <text>')
    const id = await resolveId(args[0])
    const text = args.slice(1).join(' ')
    if (!text) return die('Usage: ctx comment <task-id> <text>')

    const content = readStdinOrFile(text)
    const data = await post(`/api/agents/tasks/${id}/comments`, { content })
    if (JSON_OUT) return json(data)
    print(`✓ Comment added (${data.id.slice(-8)})`)
  },
}

// ── comments ────────────────────────────────────────────────────────────────

commands.comments = {
  usage: 'ctx comments <task-id>',
  desc: 'List comments on a task',
  async run(args, flags) {
    requireToken()
    if (!args[0]) return die('Usage: ctx comments <task-id>')
    const id = await resolveId(args[0])

    const data = await get(`/api/agents/tasks/${id}/comments`)
    if (JSON_OUT) return json(data)
    print('')
    const comments = data.comments || data
    if (!comments.length) return print('  No comments.\n')
    comments.forEach(c => {
      print(`  ${c.user.name} — ${new Date(c.createdAt).toLocaleString()}`)
      print(`  ${c.content}\n`)
    })
  },
}

// ── attach ──────────────────────────────────────────────────────────────────

commands.attach = {
  usage: 'ctx attach <task-id> <file-path>',
  desc: 'Upload a file attachment to a task',
  async run(args) {
    requireToken()
    if (!args[0] || !args[1]) return die('Usage: ctx attach <task-id> <file-path>')
    const id = await resolveId(args[0])
    const filePath = args[1]

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    const bytes = readFileSync(filePath)
    const form = new FormData()
    form.append('file', new Blob([bytes]), basename(filePath))

    const data = await postMultipart(`/api/agents/tasks/${id}/attachments`, form)
    if (JSON_OUT) return json(data)
    print(`✓ Attachment uploaded: ${data.name} (${data.id.slice(-8)})`)
  },
}

// ── attachments ─────────────────────────────────────────────────────────────

commands.attachments = {
  usage: 'ctx attachments <task-id>',
  desc: 'List attachments on a task',
  async run(args) {
    requireToken()
    if (!args[0]) return die('Usage: ctx attachments <task-id>')
    const id = await resolveId(args[0])

    const data = await get(`/api/agents/tasks/${id}/attachments`)
    if (JSON_OUT) return json(data)
    print('')
    if (!data.length) return print('  No attachments.\n')
    table(data, [
      { label: 'ID', get: r => r.id.slice(-8) },
      { label: 'Name', get: r => r.name },
      { label: 'Size', get: r => formatBytes(r.sizeBytes) },
      { label: 'Type', get: r => r.mimeType || 'application/octet-stream' },
      { label: 'Created', get: r => new Date(r.createdAt).toLocaleString() },
    ])
    print('')
  },
}

// ── docs ────────────────────────────────────────────────────────────────────

commands.docs = {
  usage: 'ctx docs <task-id>',
  desc: 'List documents on a task',
  async run(args, flags) {
    requireToken()
    if (!args[0]) return die('Usage: ctx docs <task-id>')
    const id = await resolveId(args[0])

    const data = await get(`/api/agents/tasks/${id}/docs`)
    if (JSON_OUT) return json(data)
    print('')
    if (!data.length) return print('  No documents.\n')
    table(data, [
      { label: 'ID', get: r => r.id.slice(-8) },
      { label: 'Title', get: r => r.title },
      { label: 'Versions', get: r => r.versionCount },
      { label: 'Locked', get: r => r.isLocked ? '🔒' : '' },
      { label: 'Updated', get: r => new Date(r.updatedAt).toLocaleDateString() },
    ])
    print('')
  },
}

// ── doc ─────────────────────────────────────────────────────────────────────

commands.doc = {
  usage: 'ctx doc <task-id> <action> [args]',
  desc: 'Create, view, or update a document',
  async run(args, flags) {
    requireToken()
    if (!args[0] || !args[1]) {
      return die('Usage: ctx doc <task-id> create|get|update [args]')
    }
    const taskId = await resolveId(args[0])
    const action = args[1]

    if (action === 'create') {
      const title = args[2]
      const contentArg = args[3]
      if (!title) return die('Usage: ctx doc <task-id> create <title> [content | file | -] [--plan]')

      const body = { title }
      if (contentArg) body.content = readStdinOrFile(contentArg)
      if (flags.has('--plan')) body.setAsPlan = true

      const data = await post(`/api/agents/tasks/${taskId}/docs`, body)
      if (JSON_OUT) return json(data)
      print(`✓ Created document: ${data.title} (${data.id.slice(-8)})`)
    }
    else if (action === 'get') {
      const docIdRaw = args[2]
      if (!docIdRaw) return die('Usage: ctx doc <task-id> get <doc-id>')
      const docId = await resolveDocId(taskId, docIdRaw)

      const data = await get(`/api/agents/tasks/${taskId}/docs/${docId}`)
      if (JSON_OUT) return json(data)
      print(`\n  📄 ${data.title}`)
      print(`  ID:       ${data.id}`)
      print(`  Locked:   ${data.isLocked ? 'yes' : 'no'}`)
      print(`  Versions: ${data.versions?.length || 0}`)
      print(`  By:       ${data.createdBy.name}`)
      if (data.content) {
        print('\n' + data.content.split('\n').map(l => '  ' + l).join('\n'))
      }
      print('')
    }
    else if (action === 'update') {
      const docIdRaw = args[2]
      const contentArg = args[3]
      if (!docIdRaw) return die('Usage: ctx doc <task-id> update <doc-id> [content | file | -] [--label L] [--major]')
      const docId = await resolveDocId(taskId, docIdRaw)

      const body = {}
      if (contentArg) body.content = readStdinOrFile(contentArg)
      const label = flags.get('--label')
      if (label) body.versionLabel = label
      body.versionType = flags.has('--major') ? 'MAJOR' : 'MINOR'
      const title = flags.get('--title')
      if (title) body.title = title

      const data = await patch(`/api/agents/tasks/${taskId}/docs/${docId}`, body)
      if (JSON_OUT) return json(data)
      print(`✓ Updated document: ${data.title} (v${data.latestVersion?.versionNumber || '?'})`)
    }
    else {
      die(`Unknown doc action: ${action}. Use create, get, or update.`)
    }
  },
}

// ── Arg parsing helpers ─────────────────────────────────────────────────────

// Parse raw args into { positional: string[], flags: Map<string, string|true> }
// Flags: --key value (next arg is value), --bool (true if no next arg or next arg is also a flag)
function parseArgs(raw) {
  const positional = []
  const flags = new Map()
  let i = 0
  while (i < raw.length) {
    const arg = raw[i]
    if (arg.startsWith('--')) {
      const key = arg
      const next = raw[i + 1]
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(key, next)
        i += 2
      } else {
        flags.set(key, true)
        i += 1
      }
    } else {
      positional.push(arg)
      i += 1
    }
  }
  return { positional, flags }
}

function die(msg) {
  console.error(msg)
  process.exit(1)
}

// ── Main ────────────────────────────────────────────────────────────────────

const [cmd, ...rawArgs] = process.argv.slice(2)
const { positional: cleanArgs, flags: globalFlags } = parseArgs(rawArgs)
const JSON_OUT_FLAG = globalFlags.has('--json')

JSON_OUT = JSON_OUT_FLAG

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  print('\n  Context CLI — project management for humans and agents\n')
  print('  Usage: ctx <command> [args] [--json]\n')
  Object.entries(commands).forEach(([name, c]) => {
    print(`  ${name.padEnd(12)} ${c.desc}`)
  })
  print(`\n  Config: CTX_TOKEN and CTX_URL env vars, or 'ctx login'\n`)
  process.exit(0)
}

if (!commands[cmd]) {
  console.error(`Unknown command: ${cmd}. Run 'ctx help' for usage.`)
  process.exit(1)
}

commands[cmd].run(cleanArgs, globalFlags).catch(e => {
  console.error(`Error: ${e.message}`)
  process.exit(1)
})
