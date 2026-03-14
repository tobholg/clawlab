#!/usr/bin/env node

// ClawLab CLI — thin wrapper around the ClawLab Agent API
// Auth: CTX_TOKEN + CTX_URL env vars, or ~/.config/clawlab/config.json

import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, rmSync } from 'node:fs'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'

// ── Config ──────────────────────────────────────────────────────────────────

const CONFIG_DIR = join(homedir(), '.config', 'clawlab')
const CONFIG_FILE = join(CONFIG_DIR, 'config.json')
const CLI_VERSION = '0.1.0'

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

function getToken() {
  const config = loadConfig()
  return process.env.CTX_TOKEN || process.env.CTX_API_TOKEN || config.token
}

function getBaseUrl() {
  const config = loadConfig()
  return (process.env.CTX_URL || config.url || 'http://localhost:3001').replace(/\/+$/, '')
}

// ── HTTP ────────────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const token = getToken()
  const base = getBaseUrl()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const opts = { method, headers, signal: AbortSignal.timeout(15000) }
  if (body) opts.body = JSON.stringify(body)

  let res
  try {
    res = await fetch(`${base}${path}`, opts)
  } catch (e) {
    const cause = e?.cause?.code || e?.code || ''
    if (cause === 'ECONNREFUSED') throw new Error(`Cannot connect to ${base} - is the server running?`)
    if (e.name === 'TimeoutError') throw new Error(`Request timed out: ${method} ${path}`)
    throw new Error(`Network error contacting ${base}: ${e.message}${cause ? ` (${cause})` : ''}`)
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
  const token = getToken()
  const base = getBaseUrl()
  const headers = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${base}${path}`, {
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

function formatAgeMs(durationMs) {
  const safeDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0
  const totalSeconds = Math.floor(safeDuration / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  return formatDurationMs(safeDuration)
}

function shortId(id) {
  return String(id || '').slice(-8)
}

function formatTaskPath(task) {
  const breadcrumb = Array.isArray(task?.breadcrumb) && task.breadcrumb.length
    ? `${task.breadcrumb.join(' › ')} › `
    : ''
  return `${breadcrumb}${task?.title || 'Untitled task'}`
}

function formatTaskRef(task) {
  return `${formatTaskPath(task)} (id: ${shortId(task?.id)})`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function requireToken() {
  if (!getToken()) {
    console.error('Error: No API token. Set CTX_TOKEN or run: clawlab login')
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
  const idMatch = channels.find(c => c.id.endsWith(idOrShort))
  if (idMatch) return idMatch.id

  const normalized = String(idOrShort).trim().toLowerCase().replace(/^#/, '')
  const slugify = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')

  const nameMatches = channels.filter((c) => {
    const candidates = [
      c.name,
      c.displayName,
      slugify(c.name),
      slugify(c.displayName),
    ].map(v => String(v || '').trim().toLowerCase().replace(/^#/, ''))
    return candidates.includes(normalized)
  })

  if (nameMatches.length === 1) return nameMatches[0].id
  if (nameMatches.length > 1) {
    const names = nameMatches.map(c => c.displayName || c.name || c.id.slice(-8)).join(', ')
    throw new Error(`Channel name is ambiguous: "${idOrShort}" matches ${names}. Use channel ID instead.`)
  }

  return idOrShort
}

async function inferActiveTaskId() {
  const session = await get('/api/agents/sessions?current=true')
  return session?.itemId || session?.task?.id || null
}

async function resolveTaskIdArgOrActive(taskArg, usageHint) {
  if (taskArg) return resolveId(taskArg)

  const inferred = await inferActiveTaskId()
  if (inferred) return inferred
  die(`No active session. Usage: ${usageHint}`)
}

function looksLikeTaskIdToken(value) {
  if (!value || typeof value !== 'string') return false
  return /^[a-z0-9]{8}$/i.test(value) || /^c[a-z0-9]{16,}$/i.test(value)
}

function normalizeMode(value) {
  if (!value) return null
  const normalized = String(value).trim().toUpperCase()
  if (normalized === 'PLAN' || normalized === 'EXECUTE') return normalized
  return null
}

function priorityRank(priority) {
  return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }[String(priority || '').toUpperCase()] ?? 4
}

function statusRank(status) {
  return { IN_PROGRESS: 0, TODO: 1, BLOCKED: 2, PAUSED: 3, DONE: 4 }[String(status || '').toUpperCase()] ?? 5
}

function modeRank(mode, preferredMode) {
  const normalized = normalizeMode(mode)
  if (preferredMode) {
    if (normalized === preferredMode) return 0
    if (normalized) return 1
    return 2
  }
  if (normalized === 'EXECUTE') return 0
  if (normalized === 'PLAN') return 1
  return 2
}

function isStartableTask(task) {
  if (!task) return false
  const itemType = String(task.itemType || 'TASK').toUpperCase()
  if (itemType !== 'TASK') return false
  const status = String(task.status || '').toUpperCase()
  if (status === 'DONE') return false
  const subStatus = String(task.subStatus || '').toLowerCase()
  return subStatus !== 'review'
}

function selectStartTask(tasks, preferredMode) {
  const startable = tasks.filter(isStartableTask)
  const sorted = [...startable].sort((a, b) => {
    const modeDiff = modeRank(a.agentMode, preferredMode) - modeRank(b.agentMode, preferredMode)
    if (modeDiff !== 0) return modeDiff
    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority)
    if (priorityDiff !== 0) return priorityDiff
    const statusDiff = statusRank(a.status) - statusRank(b.status)
    if (statusDiff !== 0) return statusDiff
    const updatedDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    if (updatedDiff !== 0) return updatedDiff
    return String(a.title || '').localeCompare(String(b.title || ''))
  })
  return { candidate: sorted[0] || null, totalStartable: startable.length }
}

function buildStartRationale(task, preferredMode) {
  const details = [
    `mode=${task.agentMode || 'none'}`,
    `priority=${task.priority || 'none'}`,
    `status=${task.status}${task.subStatus ? `/${task.subStatus}` : ''}`,
    `updated=${new Date(task.updatedAt).toLocaleString()}`,
  ]
  if (preferredMode) details.push(`preferredMode=${preferredMode}`)
  return details.join(' · ')
}

function renderCheckoutSummary(data) {
  const task = data.task || {}
  const subtasks = task.subtasks || []
  const done = subtasks.filter(s => s.status === 'DONE').length
  const inProgress = subtasks.filter(s => s.status === 'IN_PROGRESS').length
  const todo = Math.max(0, subtasks.length - done - inProgress)
  const planText = task.planDoc ? `${task.planDoc.title} (${task.planDoc.id.slice(-8)})` : 'None'

  print(`✓ Checked out: ${task.title}`)
  if (!task.parentId) {
    print('')
    print('  ⚠  This is a top-level project, not a task.')
    print('     Agents should create and work on tasks beneath projects.')
    print(`     Use: clawlab task create --parent ${task.id} --title "Your task title"`)
    print('     Then check out that task instead.')
    print('')
  }
  print(`  Mode:     ${task.agentMode || 'N/A'}`)
  print(`  Plan:     ${planText}`)
  print(`  Subtasks: ${subtasks.length} (${done} done, ${inProgress} in progress, ${todo} todo)`)
  print('  Duration tracking started.')
}

async function runSubmitPreflight(taskId, activeSession) {
  const task = await get(`/api/agents/tasks/${taskId}`)
  const checks = []

  const isTaskActive = activeSession?.itemId === taskId
  checks.push({
    key: 'active_session',
    level: isTaskActive ? 'pass' : 'fail',
    message: isTaskActive
      ? 'Active session is checked out on this task'
      : 'No active session found for this task. Run clawlab checkout first.',
  })

  const inReview = String(task.subStatus || '').toLowerCase() === 'review'
  checks.push({
    key: 'review_state',
    level: inReview ? 'warn' : 'pass',
    message: inReview
      ? 'Task is already in review. Submitting again is usually unnecessary.'
      : 'Task is not yet in review state',
  })

  if (task.agentMode === 'PLAN') {
    const hasPlanDoc = Boolean(task.planDocId)
    checks.push({
      key: 'plan_doc',
      level: hasPlanDoc ? 'pass' : 'fail',
      message: hasPlanDoc
        ? `Plan document linked (${String(task.planDocId).slice(-8)})`
        : 'PLAN mode task requires a linked plan document before submit.',
    })
  }

  const hasFailures = checks.some(check => check.level === 'fail')
  const hasWarnings = checks.some(check => check.level === 'warn')

  return {
    ok: !hasFailures,
    hasWarnings,
    task: {
      id: task.id,
      title: task.title,
      status: task.status,
      subStatus: task.subStatus,
      progress: task.progress,
      agentMode: task.agentMode,
      planDocId: task.planDocId,
    },
    checks,
  }
}

function buildPlanTemplate(task) {
  const title = task?.title || 'Task'
  const projectTitle = task?.project?.title || 'N/A'
  const date = new Date().toISOString().slice(0, 10)
  return [
    `# Plan: ${title}`,
    '',
    `Date: ${date}`,
    `Task ID: ${task?.id || 'N/A'}`,
    `Project: ${projectTitle}`,
    '',
    '## Objective',
    '- What outcome should this task produce?',
    '- What user/team value will it unlock?',
    '',
    '## Scope',
    '- In scope:',
    '- Out of scope:',
    '',
    '## Implementation Steps',
    '1. ',
    '2. ',
    '3. ',
    '',
    '## Validation',
    '- What tests/checks will confirm correctness?',
    '',
    '## Risks and Mitigations',
    '- Risk:',
    '  Mitigation:',
    '',
    '## Acceptance Criteria',
    '- [ ] ',
    '- [ ] ',
  ].join('\n')
}

function isActionableCatchupTask(task) {
  if (!task?.agentMode) return false
  const itemType = String(task.itemType || 'TASK').toUpperCase()
  if (itemType !== 'TASK') return false
  const status = String(task.status || '').toUpperCase()
  if (status === 'DONE') return false
  const subStatus = String(task.subStatus || '').toLowerCase()
  return subStatus !== 'review'
}

function isWaitingReviewCatchupTask(task) {
  if (!task?.agentMode) return false
  const itemType = String(task.itemType || 'TASK').toUpperCase()
  if (itemType !== 'TASK') return false
  const status = String(task.status || '').toUpperCase()
  if (status === 'DONE') return false
  const subStatus = String(task.subStatus || '').toLowerCase()
  return subStatus === 'review'
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

function resolveHookPath(rawPath) {
  if (!rawPath) throw new Error('Unable to resolve git hook path')
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath)
}

function installPostCommitHook() {
  let hookPath
  try {
    const rawHookPath = execSync('git rev-parse --git-path hooks/post-commit', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    hookPath = resolveHookPath(rawHookPath)
  } catch {
    throw new Error('Not inside a git repository')
  }

  const marker = '# clawlab commit hook'
  const command = 'clawlab commit --sha "$SHA" 2>/dev/null || true'
  const hookBlock = `${marker}\nSHA=$(git rev-parse HEAD)\n${command}`

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf-8')
    if (existing.includes(command)) {
      chmodSync(hookPath, 0o755)
      return { hookPath, appended: false, alreadyInstalled: true }
    }

    const next = `${existing.replace(/\s*$/, '\n')}\n${hookBlock}\n`
    writeFileSync(hookPath, next)
    chmodSync(hookPath, 0o755)
    return { hookPath, appended: true, alreadyInstalled: false }
  }

  const content = `#!/bin/sh\n${hookBlock}\n`
  writeFileSync(hookPath, content)
  chmodSync(hookPath, 0o755)
  return { hookPath, appended: false, alreadyInstalled: false }
}

// ── Commands ────────────────────────────────────────────────────────────────

const commands = {}

// ── login ───────────────────────────────────────────────────────────────────

commands.login = {
  usage: 'clawlab login [--url URL] [--token TOKEN]',
  desc: 'Configure authentication',
  async run(args, flags) {
    const url = String(flags.get('--url') || getBaseUrl()).replace(/\/+$/, '')
    const token = flags.get('--token')

    if (!token) {
      console.error('Usage: clawlab login --token ctx_xxx [--url http://localhost:3001]')
      process.exit(1)
    }

    saveConfig({ url, token })

    // Verify
    let verified = false
    let agent = null
    try {
      const headers = { Authorization: `Bearer ${token}` }
      const res = await fetch(`${url}/api/agents/me`, { headers })
      if (res.ok) {
        agent = await res.json()
        verified = true
      } else {
        verified = false
      }
    } catch {
      verified = false
    }

    if (JSON_OUT) {
      return json({
        saved: true,
        configFile: CONFIG_FILE,
        url,
        verified,
        agent,
      })
    }

    print(`✓ Config saved to ${CONFIG_FILE}`)
    print('Run `clawlab me` to verify this machine is connected.')
    if (verified && agent) {
      const providerSuffix = agent.agentProvider ? ` (${agent.agentProvider})` : ''
      print(`✓ Authenticated as ${agent.name}${providerSuffix}`)
    } else {
      print(`⚠ Token saved but verification failed — check your token and URL (${url})`)
    }
  },
}

// ── logout ──────────────────────────────────────────────────────────────────

commands.logout = {
  usage: 'clawlab logout',
  desc: 'Remove saved authentication config',
  async run() {
    rmSync(CONFIG_FILE, { force: true })

    if (JSON_OUT) {
      return json({ revoked: true, configFile: CONFIG_FILE })
    }

    print(`✓ Removed ${CONFIG_FILE}`)
  },
}

// ── api (discovery) ─────────────────────────────────────────────────────────

commands.api = {
  usage: 'clawlab api [endpoint-id]',
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
  usage: 'clawlab me',
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
  usage: 'clawlab catchup [--since 4h] [--refresh]',
  desc: 'Show everything you missed: tasks, mentions, comments, thread replies',
  help: [
    'Examples:',
    '  clawlab catchup',
    '  clawlab catchup --since 2h',
    '  clawlab catchup --refresh',
    '  clawlab catchup --since 2026-02-18T17:00:00Z',
  ].join('\n'),
  async run(args, flags) {
    requireToken()

    const since = flags.get('--since') || '4h'
    const refresh = flags.has('--refresh')
    const query = new URLSearchParams({ since: String(since) })
    if (refresh) {
      query.set('refresh', 'true')
      query.set('r', String(Date.now()))
    }

    const data = await get(`/api/agents/catchup?${query.toString()}`)
    if (JSON_OUT) return json(data)

    const s = data.summary
    const total = s.newTaskCount + s.updatedTaskCount + s.commentCount + s.mentionCount + s.threadReplyCount

    print(`\n  Catch-up since ${new Date(data.since).toLocaleString()}`)
    if (data.generatedAt) {
      print(`  Snapshot at ${new Date(data.generatedAt).toLocaleString()}`)
      print(`  Data age ${formatAgeMs(Date.now() - new Date(data.generatedAt).getTime())}`)
    }
    if (refresh) {
      print('  Refresh mode requested')
    }
    print(`  ─────────────────────────────────`)

    if (total === 0) {
      print(`  Nothing new. All caught up! ✓\n`)
      return
    }

    // Action required: tasks with agentMode set and not already in review/done
    const allTasks = [...(data.tasks.assigned || []), ...(data.tasks.updated || [])]
    const actionTasks = allTasks.filter(isActionableCatchupTask)
    const waitingReviewTasks = allTasks.filter(isWaitingReviewCatchupTask)
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
        const isProject = !t.parentId
        print(``)
        print(`     ⚡ ${modeLabel}  ${isProject ? '📁 ' : ''}${formatTaskRef(t)}  ${t.progress ?? 0}%`)
        if (isProject) {
          print(`       ⚠  This is a project, not a task. Create tasks under it:`)
          print(`       $ clawlab task create --parent ${t.id.slice(-8)} --title "Task title"`)
        } else if (isCurrentTask) {
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
              const assignee = s.assignees?.[0]?.user?.name || s.owner?.name || ''
              const assigneeTag = assignee ? ` [${assignee}]` : ''
              print(`         ${icon} ${st} ${s.title}${assigneeTag}`)
            }
          }
        } catch { /* skip if fetch fails */ }

        print(`       $ clawlab task ${shortId(t.id)}          # view details`)
        if (mode === 'plan') {
          print(`       $ clawlab doc ${shortId(t.id)} create "Plan title"  # start your plan`)
        }
      }
    }

    if (waitingReviewTasks.length > 0) {
      print(`\n  ⏳ Awaiting human review (${waitingReviewTasks.length})`)
      for (const t of waitingReviewTasks) {
        print(`     ${formatTaskRef(t)}  ${t.progress ?? 0}%`)
      }
    }

    // Filter action tasks out of regular lists to avoid duplication
    const actionIds = new Set(actionTasks.map(t => t.id))

    const newTasks = (data.tasks.assigned || []).filter(t => !actionIds.has(t.id))
    if (newTasks.length > 0) {
      print(`\n  📋 New tasks (${newTasks.length})`)
      for (const t of newTasks) {
        const isProject = !t.parentId
        print(`     ${t.status.padEnd(12)} ${isProject ? '📁 ' : ''}${formatTaskRef(t)}`)
        if (isProject) {
          print(`       ⚠  Project — create tasks under it, don't work on it directly`)
        }
      }
    }

    const updatedTasks = (data.tasks.updated || []).filter(t => !actionIds.has(t.id))
    if (updatedTasks.length > 0) {
      print(`\n  🔄 Updated tasks (${updatedTasks.length})`)
      for (const t of updatedTasks) {
        print(`     ${t.status.padEnd(12)} ${formatTaskRef(t)}`)
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
        if (m.replyTo) {
          print(`       ↳ clawlab channels ${m.channelName} --reply "..." --thread ${m.replyTo}`)
        }
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
  usage: 'clawlab checkout <task-id>',
  desc: 'Start a tracked work session on a task',
  async run(args) {
    requireToken()
    if (!args[0]) return die('Usage: clawlab checkout <task-id>')
    const taskId = await resolveId(args[0])

    const data = await post('/api/agents/checkout', { taskId })
    if (JSON_OUT) return json(data)
    renderCheckoutSummary(data)
  },
}

// ── start ──────────────────────────────────────────────────────────────────

commands.start = {
  usage: 'clawlab start [--preview] [--mode PLAN|EXECUTE]',
  desc: 'Pick the next actionable assigned task and optionally check it out',
  help: [
    'Examples:',
    '  clawlab start',
    '  clawlab start --preview',
    '  clawlab start --mode PLAN',
  ].join('\n'),
  async run(args, flags) {
    requireToken()

    const modeFlag = flags.get('--mode')
    const preferredMode = normalizeMode(modeFlag)
    if (modeFlag && !preferredMode) {
      throw new Error('Invalid --mode value. Use PLAN or EXECUTE.')
    }

    const preview = flags.has('--preview')
    const tasks = await get('/api/agents/tasks')
    const { candidate, totalStartable } = selectStartTask(tasks, preferredMode)

    if (!candidate) {
      if (JSON_OUT) return json({ found: false, reason: 'No actionable assigned tasks' })
      print('No actionable assigned tasks found.')
      print('Run `clawlab catchup --refresh` to sync latest assignments.')
      return
    }

    const rationale = buildStartRationale(candidate, preferredMode)

    if (JSON_OUT) {
      if (preview) {
        return json({
          found: true,
          preview: true,
          totalStartable,
          selectedTask: candidate,
          rationale,
        })
      }

      const data = await post('/api/agents/checkout', { taskId: candidate.id })
      return json({
        found: true,
        preview: false,
        totalStartable,
        selectedTask: candidate,
        rationale,
        checkout: data,
      })
    }

    print(`Selected task: ${candidate.title} (${candidate.id.slice(-8)})`)
    print(`  Rationale: ${rationale}`)
    print(`  Startable tasks: ${totalStartable}`)

    if (preview) {
      print(`  Next: clawlab checkout ${candidate.id.slice(-8)}`)
      return
    }

    const data = await post('/api/agents/checkout', { taskId: candidate.id })
    renderCheckoutSummary(data)
  },
}

// ── submit ─────────────────────────────────────────────────────────────────

commands.submit = {
  usage: 'clawlab submit [task-id] [--dry-run]',
  desc: 'Submit active work session for review. Infers task from active session if omitted.',
  help: [
    'Examples:',
    '  clawlab submit',
    '  clawlab submit --dry-run',
    '  clawlab submit 7f3a --dry-run',
  ].join('\n'),
  async run(args, flags) {
    requireToken()

    const dryRun = flags.has('--dry-run')
    const taskId = await resolveTaskIdArgOrActive(args[0], 'clawlab submit [task-id] [--dry-run]')
    const activeSession = await get('/api/agents/sessions?current=true')

    if (dryRun) {
      const preflight = await runSubmitPreflight(taskId, activeSession)
      if (JSON_OUT) return json(preflight)

      print('\n  Submit preflight')
      print('  ───────────────')
      print(`  Task: ${preflight.task.title} (${preflight.task.id.slice(-8)})`)
      print(`  Mode: ${preflight.task.agentMode || 'N/A'}`)
      print(`  Status: ${preflight.task.status}${preflight.task.subStatus ? `/${preflight.task.subStatus}` : ''}`)
      preflight.checks.forEach((check) => {
        const icon = check.level === 'pass' ? '✓' : check.level === 'warn' ? '⚠' : '✕'
        print(`  ${icon} ${check.message}`)
      })
      if (preflight.ok) {
        print('\n  Ready to submit.')
      } else {
        print('\n  Preflight failed. Resolve blockers before submit.')
      }
      print('')
      if (!preflight.ok) process.exit(1)
      return
    }

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
    print(`  Progress:  ${task.progress}% (set automatically — human approval required for 100%)`)
  },
}

// ── commit ─────────────────────────────────────────────────────────────────

commands.commit = {
  usage: 'clawlab commit --sha <sha> [--task <task-id>]',
  desc: 'Link a git commit to your active task (or a specific task)',
  help: [
    'Examples:',
    '  clawlab commit --sha abc1234',
    '  clawlab commit --sha abc1234 --task 7f3a',
  ].join('\n'),
  async run(args, flags) {
    requireToken()

    const shaFlag = flags.get('--sha')
    if (typeof shaFlag !== 'string' || !shaFlag.trim()) {
      return die('Usage: clawlab commit --sha <sha> [--task <task-id>]')
    }

    const taskFlag = flags.get('--task')
    const payload = { sha: shaFlag.trim() }
    if (typeof taskFlag === 'string' && taskFlag.trim()) {
      payload.taskId = await resolveId(taskFlag.trim())
    }

    const data = await post('/api/agents/commits', payload)
    if (JSON_OUT) return json(data)

    const shortSha = data.shortSha || String(data.sha || '').slice(0, 7)
    const title = data.item?.title || 'task'
    const insertions = Number(data.insertions || 0)
    const deletions = Number(data.deletions || 0)
    const files = Number(data.filesChanged || 0)
    const fileLabel = files === 1 ? 'file' : 'files'
    print(`Linked ${shortSha} to "${title}" (+${insertions} -${deletions}, ${files} ${fileLabel})`)
  },
}

// ── init-hooks ─────────────────────────────────────────────────────────────

commands['init-hooks'] = {
  usage: 'clawlab init-hooks',
  desc: 'Install a git post-commit hook to auto-link commits',
  async run() {
    const result = installPostCommitHook()
    if (JSON_OUT) return json(result)

    if (result.alreadyInstalled) {
      print(`✓ Hook already installed: ${result.hookPath}`)
      return
    }

    if (result.appended) {
      print(`⚠ Existing post-commit hook found. Appended clawlab hook block: ${result.hookPath}`)
      return
    }

    print(`✓ Installed post-commit hook: ${result.hookPath}`)
  },
}

// ── status ─────────────────────────────────────────────────────────────────

commands.status = {
  usage: 'clawlab status',
  desc: 'Show current active session status',
  async run() {
    requireToken()
    const session = await get('/api/agents/sessions?current=true')
    if (JSON_OUT) return json(session)

    if (!session) {
      print('No active session. Run `clawlab checkout <task-id>` to start working.')
      return
    }

    const checkedOutAt = session.checkedOutAt ? new Date(session.checkedOutAt).getTime() : Date.now()
    const elapsed = formatDurationMs(Date.now() - checkedOutAt)
    const taskId = session.task?.id || session.itemId || ''
    const taskIdSuffix = taskId ? shortId(taskId) : 'unknown'

    print('')
    print(`  Agent:    ${session.agent?.name || 'Unknown'}`)
    print(`  Session:  active since ${elapsed} ago`)
    print(`  Task:     ${session.task?.title || 'Unknown task'}`)
    if (session.project?.title) print(`  Project:  ${session.project.title}`)
    print(`  Task key: ${taskIdSuffix}`)
    print(`  Mode:     ${session.task?.agentMode || 'N/A'}`)
    print(`  Progress: ${session.task?.progress ?? 0}%`)
    print('')
  },
}

// ── projects ────────────────────────────────────────────────────────────────

commands.projects = {
  usage: 'clawlab projects',
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
  usage: 'clawlab create-project <title> [--description "text"]',
  desc: 'Create a new top-level project',
  async run(args, flags) {
    requireToken()
    const title = args.join(' ')
    if (!title) return die('Usage: clawlab create-project <title>')

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
  usage: 'clawlab channels [channel-id|channel-name] [--since 2h] [--mentions-only] [--reply \"text\"] [--thread <message-id>] [--limit 20]',
  desc: 'List channels, read channel messages, or reply in a channel/thread',
  help: [
    'Examples:',
    '  clawlab channels',
    '  clawlab channels general --limit 10',
    '  clawlab channels 6mol66p4 --reply "Working on it"',
    '  clawlab channels general --reply "Ack" --thread <message-id>',
  ].join('\n'),
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
  usage: 'clawlab tasks [--tree] [--status STATUS]',
  desc: 'List assigned tasks (--tree for hierarchy)',
  async run(args, flags) {
    requireToken()
    const data = await get('/api/agents/tasks')
    const projects = await get('/api/agents/projects').catch(() => [])
    const projectTitleById = new Map((Array.isArray(projects) ? projects : []).map((p) => [p.id, p.title]))
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
        const projectPrefix = t.project?.title ? `${t.project.title} › ` : ''
        print(`  ${statusIcon(t.status)} ${priorityIcon(t.priority)} ${projectPrefix}${t.title}${t.category ? '  [' + t.category + ']' : ''}`)
        print(`    key: ${shortId(t.id)}  ${t.status}  ${t.progress ?? 0}%`)
        const subs = t.subtasks || []
        subs.forEach((s, i) => {
          const isLast = i === subs.length - 1
          const prefix = isLast ? '└─' : '├─'
          print(`    ${prefix} ${statusIcon(s.status)} ${priorityIcon(s.priority || 'MEDIUM')} ${s.title} (id: ${shortId(s.id)})`)
        })
        print('')
      })
      return
    }

    print('')
    if (!data.length) return print('  No tasks assigned.\n')
    data.forEach(t => {
      const projectTitle = projectTitleById.get(t.projectId)
      const contextualTitle = projectTitle ? `${t.title} — ${projectTitle}` : t.title
      print(`  ${statusIcon(t.status)} ${priorityIcon(t.priority)} ${contextualTitle}`)
      print(`    ${t.status}  ${t.progress}%${t.category ? '  [' + t.category + ']' : ''}  (id: ${shortId(t.id)})`)
      print('')
    })
  },
}

// ── task (detail / update) ──────────────────────────────────────────────────

commands.task = {
  usage: 'clawlab task [task-id] [--status S] [--progress N] [--title T] [--desc T] [--category C] [--priority P] [--substatus S]',
  desc: 'View or update a task. Infers active task when task-id is omitted.',
  help: [
    'Examples:',
    '  clawlab task',
    '  clawlab task 7f3a',
    '  clawlab task --progress 60',
  ].join('\n'),
  async run(args, flags) {
    requireToken()
    const id = await resolveTaskIdArgOrActive(args[0], 'clawlab task [task-id] [--status S] [--progress N] [--title T] [--desc T] [--category C] [--priority P] [--substatus S]')

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
  usage: 'clawlab subtask <parent-id> <title> [--desc D] [--category C] [--priority P]',
  desc: 'Create a subtask',
  async run(args, flags) {
    requireToken()
    if (!args[0] || !args[1]) return die('Usage: clawlab subtask <parent-id> <title>')
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
  usage: 'clawlab rm <task-id>',
  desc: 'Delete an agent-owned subtask',
  async run(args, flags) {
    requireToken()
    if (!args[0]) return die('Usage: clawlab rm <task-id>')
    const id = await resolveId(args[0])
    await del(`/api/agents/tasks/${id}`)
    if (JSON_OUT) return json({ deleted: true, id })
    print(`✓ Deleted ${id.slice(-8)}`)
  },
}

// ── comment ─────────────────────────────────────────────────────────────────

commands.comment = {
  usage: 'clawlab comment [task-id] <text | file | ->',
  desc: 'Add a comment to a task. Infers active task when task-id is omitted.',
  help: [
    'Examples:',
    '  clawlab comment "Investigating regression"',
    '  clawlab comment 7f3a "Implemented auth fallback"',
  ].join('\n'),
  async run(args, flags) {
    requireToken()
    if (!args[0]) return die('Usage: clawlab comment [task-id] <text>')

    let id
    let text
    if (args.length === 1) {
      id = await resolveTaskIdArgOrActive(null, 'clawlab comment [task-id] <text>')
      text = args[0]
    } else if (looksLikeTaskIdToken(args[0])) {
      id = await resolveId(args[0])
      text = args.slice(1).join(' ')
    } else {
      id = await resolveTaskIdArgOrActive(null, 'clawlab comment [task-id] <text>')
      text = args.join(' ')
    }
    if (!text) return die('Usage: clawlab comment [task-id] <text>')

    const content = readStdinOrFile(text)
    const data = await post(`/api/agents/tasks/${id}/comments`, { content })
    if (JSON_OUT) return json(data)
    print(`✓ Comment added (${data.id.slice(-8)})`)
  },
}

// ── comments ────────────────────────────────────────────────────────────────

commands.comments = {
  usage: 'clawlab comments [task-id]',
  desc: 'List comments on a task. Infers active task when task-id is omitted.',
  help: [
    'Examples:',
    '  clawlab comments',
    '  clawlab comments 7f3a',
  ].join('\n'),
  async run(args, flags) {
    requireToken()
    const id = await resolveTaskIdArgOrActive(args[0], 'clawlab comments [task-id]')

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
  usage: 'clawlab attach [task-id] <file-path>',
  desc: 'Upload a file attachment to a task. Infers active task when task-id is omitted.',
  help: [
    'Examples:',
    '  clawlab attach ./trace.log',
    '  clawlab attach 7f3a ./trace.log',
  ].join('\n'),
  async run(args) {
    requireToken()
    if (!args[0]) return die('Usage: clawlab attach [task-id] <file-path>')

    let id
    let filePath
    if (args.length === 1) {
      id = await resolveTaskIdArgOrActive(null, 'clawlab attach [task-id] <file-path>')
      filePath = args[0]
    } else {
      id = await resolveTaskIdArgOrActive(args[0], 'clawlab attach [task-id] <file-path>')
      filePath = args[1]
    }

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
  usage: 'clawlab attachments [task-id]',
  desc: 'List attachments on a task. Infers active task when task-id is omitted.',
  help: [
    'Examples:',
    '  clawlab attachments',
    '  clawlab attachments 7f3a',
  ].join('\n'),
  async run(args) {
    requireToken()
    const id = await resolveTaskIdArgOrActive(args[0], 'clawlab attachments [task-id]')

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
  usage: 'clawlab docs [task-id]',
  desc: 'List documents on a task',
  help: [
    'Task ID is optional when you have an active checkout session.',
    'Example: clawlab docs',
    'Example: clawlab docs 7f3a',
  ].join('\n'),
  async run(args, flags) {
    requireToken()
    const id = await resolveTaskIdArgOrActive(args[0], 'clawlab docs [task-id]')

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
  usage: 'clawlab doc [task-id] <create|get|update> [args]',
  desc: 'Create, view, or update a document',
  help: [
    'Task ID is optional when you have an active checkout session.',
    '',
    'Actions:',
    '  create <title> [content | file | -] [--plan] [--plan-template]',
    '  get <doc-id>',
    '  update <doc-id> [content | file | -] [--label L] [--major] [--title T]',
    '',
    'Examples:',
    '  clawlab doc 7f3a create "Implementation Plan" ./plan.md --plan',
    '  clawlab doc create "Implementation Plan" ./plan.md --plan',
    '  clawlab doc create "Execution Plan" --plan-template',
    '  clawlab doc 7f3a get 12ab34cd',
    '  clawlab doc get 12ab34cd',
    '  clawlab doc 7f3a update 12ab34cd ./next.md --label "v2 draft"',
  ].join('\n'),
  async run(args, flags) {
    requireToken()
    if (!args[0] && !flags.has('--create') && !flags.has('--get') && !flags.has('--update')) {
      return die('Usage: clawlab doc [task-id] create|get|update [args]')
    }

    const normalizeAction = (value) => {
      const candidate = String(value || '').replace(/^--/, '').toLowerCase()
      return ['create', 'get', 'update'].includes(candidate) ? candidate : null
    }

    const actionAsFirst = normalizeAction(args[0])
    const actionAsSecond = normalizeAction(args[1])
    const flagActions = ['create', 'get', 'update'].filter((candidate) => flags.has(`--${candidate}`))

    let taskId
    let action
    let actionArgs

    if (actionAsFirst) {
      // clawlab doc create ...
      taskId = await resolveTaskIdArgOrActive(null, 'clawlab doc [task-id] create|get|update [args]')
      action = actionAsFirst
      actionArgs = args.slice(1)
    } else if (actionAsSecond) {
      // clawlab doc <task-id> create ...
      taskId = await resolveTaskIdArgOrActive(args[0], 'clawlab doc [task-id] create|get|update [args]')
      action = actionAsSecond
      actionArgs = args.slice(2)
    } else if (flagActions.length === 1) {
      // Legacy compatibility:
      // clawlab doc <task-id> --create "Title" [content]
      // clawlab doc --get <doc-id>
      action = flagActions[0]
      const maybeTaskArg = args[0]
      const remaining = maybeTaskArg ? args.slice(1) : []
      taskId = await resolveTaskIdArgOrActive(maybeTaskArg || null, 'clawlab doc [task-id] create|get|update [args]')
      const flagValue = flags.get(`--${action}`)
      actionArgs = []
      if (typeof flagValue === 'string' && flagValue.trim()) actionArgs.push(flagValue)
      actionArgs.push(...remaining)
    } else {
      return die('Usage: clawlab doc [task-id] create|get|update [args]')
    }

    if (action === 'create') {
      const title = actionArgs[0]
      const contentArg = actionArgs[1]
      if (!title) return die('Usage: clawlab doc [task-id] create <title> [content | file | -] [--plan] [--plan-template]')

      const body = { title }
      let templateTask = null
      if (contentArg) body.content = readStdinOrFile(contentArg)
      if (flags.has('--plan-template') && !body.content) {
        templateTask = await get(`/api/agents/tasks/${taskId}`)
        body.content = buildPlanTemplate(templateTask)
      }
      if (flags.has('--plan')) {
        body.setAsPlan = true
      } else if (flags.has('--plan-template')) {
        if (!templateTask) templateTask = await get(`/api/agents/tasks/${taskId}`)
        if (templateTask.agentMode === 'PLAN') body.setAsPlan = true
      }

      const data = await post(`/api/agents/tasks/${taskId}/docs`, body)
      if (JSON_OUT) return json(data)
      print(`✓ Created document: ${data.title} (${data.id.slice(-8)})`)
    }
    else if (action === 'get') {
      const docIdRaw = actionArgs[0]
      if (!docIdRaw) return die('Usage: clawlab doc [task-id] get <doc-id>')
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
      const docIdRaw = actionArgs[0]
      const contentArg = actionArgs[1]
      if (!docIdRaw) return die('Usage: clawlab doc [task-id] update <doc-id> [content | file | -] [--label L] [--major]')
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

function printCommandHelp(commandName) {
  const command = commands[commandName]
  if (!command) {
    console.error(`Unknown command: ${commandName}. Run 'clawlab help' for usage.`)
    process.exit(1)
  }

  print(`\n  ${command.usage}`)
  print(`  ${command.desc}`)
  if (command.help) {
    print('')
    command.help.split('\n').forEach((line) => print(`  ${line}`))
  }
  print('\n  Supports: --json\n')
}

// ── Main ────────────────────────────────────────────────────────────────────

const [cmd, ...rawArgs] = process.argv.slice(2)
if (cmd === '--version' || cmd === '-v') {
  print(CLI_VERSION)
  process.exit(0)
}

const { positional: cleanArgs, flags: globalFlags } = parseArgs(rawArgs)
const JSON_OUT_FLAG = globalFlags.has('--json')

JSON_OUT = JSON_OUT_FLAG

if (!cmd || cmd === '--help' || cmd === '-h') {
  print('\n  ClawLab CLI — project management for humans and agents\n')
  print('  Usage: clawlab <command> [args] [--json]\n')
  Object.entries(commands).forEach(([name, c]) => {
    print(`  ${name.padEnd(12)} ${c.desc}`)
  })
  print('\n  Command help: clawlab help <command>')
  print('  All commands support: --json')
  print(`\n  Config: CTX_TOKEN and CTX_URL env vars, or 'clawlab login'\n`)
  process.exit(0)
}

if (cmd === 'help') {
  if (!cleanArgs[0]) {
    print('\n  ClawLab CLI — project management for humans and agents\n')
    print('  Usage: clawlab <command> [args] [--json]\n')
    Object.entries(commands).forEach(([name, c]) => {
      print(`  ${name.padEnd(12)} ${c.desc}`)
    })
    print('\n  Command help: clawlab help <command>')
    print('  All commands support: --json')
    print(`\n  Config: CTX_TOKEN and CTX_URL env vars, or 'clawlab login'\n`)
    process.exit(0)
  }
  printCommandHelp(cleanArgs[0])
  process.exit(0)
}

if (!commands[cmd]) {
  console.error(`Unknown command: ${cmd}. Run 'clawlab help' for usage.`)
  process.exit(1)
}

// Per-command --help: show usage string
if (globalFlags.has('--help') || globalFlags.has('-h')) {
  printCommandHelp(cmd)
  process.exit(0)
}

commands[cmd].run(cleanArgs, globalFlags).catch(e => {
  console.error(`Error: ${e.message}`)
  process.exit(1)
})
