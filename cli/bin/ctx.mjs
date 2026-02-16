#!/usr/bin/env node

// Context CLI — thin wrapper around the Context Agent API
// Auth: CTX_TOKEN + CTX_URL env vars, or ~/.config/context/config.json

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
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

  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)

  const res = await fetch(`${BASE}${path}`, opts)
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

const JSON_OUT = process.argv.includes('--json')

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
  async run(args) {
    const url = flagVal(args, '--url') || BASE
    const token = flagVal(args, '--token')

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
  async run(args) {
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

// ── tasks ───────────────────────────────────────────────────────────────────

commands.tasks = {
  usage: 'ctx tasks [--tree] [--status STATUS]',
  desc: 'List assigned tasks (--tree for hierarchy)',
  async run(args) {
    requireToken()
    const data = await get('/api/agents/tasks')
    if (JSON_OUT && !args.includes('--tree')) return json(data)

    if (args.includes('--tree')) {
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
  async run(args) {
    requireToken()
    if (!args[0]) return die('Usage: ctx task <id>')
    const id = await resolveId(args[0])

    const updates = {}
    const s = flagVal(args, '--status')
    const p = flagVal(args, '--progress')
    const t = flagVal(args, '--title')
    const d = flagVal(args, '--desc')
    const c = flagVal(args, '--category')
    const pr = flagVal(args, '--priority')

    if (s) updates.status = s.toUpperCase()
    if (p) updates.progress = parseInt(p)
    if (t) updates.title = t
    if (d) updates.description = readStdinOrFile(d)
    if (c) updates.category = c
    if (pr) updates.priority = pr.toUpperCase()

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
  async run(args) {
    requireToken()
    if (!args[0] || !args[1]) return die('Usage: ctx subtask <parent-id> <title>')
    const parentId = await resolveId(args[0])
    const title = args[1]

    const body = { title }
    const d = flagVal(args, '--desc')
    const c = flagVal(args, '--category')
    const p = flagVal(args, '--priority')

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
  async run(args) {
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
  async run(args) {
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
  async run(args) {
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

// ── docs ────────────────────────────────────────────────────────────────────

commands.docs = {
  usage: 'ctx docs <task-id>',
  desc: 'List documents on a task',
  async run(args) {
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
  async run(args) {
    requireToken()
    if (!args[0] || !args[1]) {
      return die('Usage: ctx doc <task-id> create|get|update [args]')
    }
    const taskId = await resolveId(args[0])
    const action = args[1]

    if (action === 'create') {
      // Filter flags from positional args
      const positional = args.slice(2).filter(a => !a.startsWith('--'))
      const title = positional[0]
      const contentArg = positional[1]
      if (!title) return die('Usage: ctx doc <task-id> create <title> [content | file | -] [--plan]')

      const body = { title }
      if (contentArg) body.content = readStdinOrFile(contentArg)
      if (args.includes('--plan')) body.setAsPlan = true

      const data = await post(`/api/agents/tasks/${taskId}/docs`, body)
      if (JSON_OUT) return json(data)
      print(`✓ Created document: ${data.title} (${data.id.slice(-8)})`)
    }
    else if (action === 'get') {
      const docId = args[2]
      if (!docId) return die('Usage: ctx doc <task-id> get <doc-id>')

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
      const docId = args[2]
      const contentArg = args[3]
      if (!docId) return die('Usage: ctx doc <task-id> update <doc-id> [content | file | -] [--label L] [--major]')

      const body = {}
      if (contentArg) body.content = readStdinOrFile(contentArg)
      const label = flagVal(args, '--label')
      if (label) body.versionLabel = label
      body.versionType = args.includes('--major') ? 'MAJOR' : 'MINOR'
      const title = flagVal(args, '--title')
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

function flagVal(args, flag) {
  const i = args.indexOf(flag)
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null
}

function die(msg) {
  console.error(msg)
  process.exit(1)
}

// ── Main ────────────────────────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2)

// Filter out --json from args passed to commands
const cleanArgs = args.filter(a => a !== '--json')

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

commands[cmd].run(cleanArgs).catch(e => {
  console.error(`Error: ${e.message}`)
  process.exit(1)
})
