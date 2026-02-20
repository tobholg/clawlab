<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-40 flex flex-col"
    >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/75 dark:bg-black/50 backdrop-blur-md" @click="close" />

        <!-- Chrome -->
        <div class="relative z-10 flex flex-col h-full px-5 pt-5 pb-5 gap-3">

          <!-- Toolbar -->
          <div class="flex items-center gap-3 shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 bg-white/[0.06] rounded-xl flex items-center justify-center shrink-0">
                <svg class="w-5 h-5" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <span class="text-[21px] tracking-tight leading-none"><span class="font-semibold text-white">open</span><span class="font-medium text-zinc-400">ctx</span></span>
              <span
                v-if="tabs.length"
                class="text-[10px] font-medium text-zinc-500 bg-white/[0.06] px-1.5 py-0.5 rounded-md tabular-nums"
              >{{ tabs.length }}/6</span>
            </div>

            <div class="flex-1" />

            <!-- Layout toggle -->
            <div class="flex items-center gap-0.5 bg-white/[0.04] rounded-lg p-0.5 shrink-0">
              <button
                @click="layoutMode = 'tiled'"
                :class="layoutMode === 'tiled' ? 'bg-white/[0.08] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'"
                class="w-7 h-7 flex items-center justify-center rounded-md transition-all"
                title="Tiled layout"
              >
                <Icon name="heroicons:squares-2x2" class="w-3.5 h-3.5" />
              </button>
              <button
                @click="layoutMode = 'columns'"
                :class="layoutMode === 'columns' ? 'bg-white/[0.08] text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'"
                class="w-7 h-7 flex items-center justify-center rounded-md transition-all"
                title="Columns layout"
              >
                <Icon name="heroicons:view-columns" class="w-3.5 h-3.5" />
              </button>
            </div>

            <template v-if="tabs.length < 6">
              <!-- + Shell -->
              <button
                @click="launchShell"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/30 transition-all shrink-0"
              >
                <Icon name="heroicons:plus" class="w-3.5 h-3.5" />
                Shell
                <kbd class="ml-0.5 text-[10px] text-cyan-400/50 bg-cyan-500/10 px-1 py-0.5 rounded font-mono leading-none">⌥T</kbd>
              </button>

              <!-- Agent hover dropdown -->
              <div class="relative group/agent shrink-0">
                <button
                  @mouseenter="fetchWorkspaceAgents"
                  class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 hover:border-violet-500/30 transition-all"
                >
                  <Icon name="heroicons:cpu-chip" class="w-3.5 h-3.5" />
                  Agent
                  <Icon name="heroicons:chevron-down" class="w-3 h-3 opacity-40" />
                </button>
                <!-- Dropdown — pt-1.5 bridges the gap so mouse stays inside group -->
                <div class="absolute top-full right-0 w-64 pt-1.5 opacity-0 group-hover/agent:opacity-100 pointer-events-none group-hover/agent:pointer-events-auto transition-opacity duration-150 z-50">
                  <div class="bg-[#1c1c22] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden -translate-y-1 group-hover/agent:translate-y-0 transition-transform duration-150">
                    <div v-if="loadingAgents" class="px-4 py-4 text-sm text-zinc-500 text-center">Loading…</div>
                    <div v-else-if="!workspaceAgents.length" class="px-4 py-4 text-sm text-zinc-500 text-center">No agents configured.<br><span class="text-zinc-600 text-xs">Add one in Settings → Agents.</span></div>
                    <button
                      v-for="agent in workspaceAgents"
                      :key="agent.id"
                      @click="launchAgentTerminal(agent)"
                      class="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors text-left"
                    >
                      <div class="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                        <Icon name="heroicons:cpu-chip" class="w-3.5 h-3.5 text-violet-400" />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-zinc-200">{{ agent.name }}</div>
                        <div class="text-xs text-zinc-500 truncate">{{ agent.runnerCommand || agent.agentProvider || 'No runner configured' }}</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </template>
            <span v-else class="text-xs text-zinc-600 px-1">Max 6 open</span>

            <!-- Close overlay -->
            <button
              @click="close"
              class="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>

          <!-- Terminal grid -->
          <div
            class="flex-1 min-h-0 grid gap-2"
            :class="gridClass"
          >
            <!-- Empty state -->
            <div
              v-if="!tabs.length"
              class="flex items-center justify-center"
            >
              <div class="text-center">
                <Icon name="heroicons:command-line" class="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                <p class="text-zinc-400 font-medium mb-1">No active terminals</p>
                <p class="text-zinc-600 text-sm mb-4">Launch a terminal to start an agent session</p>
                <button
                  @click="showLauncher = true"
                  class="px-4 py-2 rounded-lg text-sm font-medium text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
                >
                  <Icon name="heroicons:plus" class="w-4 h-4 inline mr-1" />
                  Launch Terminal
                </button>
              </div>
            </div>

            <!-- Terminal tiles -->
            <div
              v-for="(tab, index) in tabs"
              :key="tab.terminalId"
              class="flex flex-col rounded-xl overflow-hidden border transition-all duration-150"
              :class="[tileClass(index), activeTabId === tab.terminalId
                ? 'border-violet-500/40 shadow-[0_0_0_1px_rgba(139,92,246,0.15)]'
                : 'border-white/[0.06] hover:border-white/[0.12]']"
              @click="switchTab(tab.terminalId); focusTerminal(tab.terminalId)"
            >
              <!-- Tile header -->
              <div
                class="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-white/[0.06] select-none"
                :class="activeTabId === tab.terminalId ? 'bg-violet-950/40' : 'bg-[#111115]'"
              >
                <!-- Status dot -->
                <span :class="[
                  'w-1.5 h-1.5 rounded-full shrink-0',
                  tab.status === 'active' ? 'bg-emerald-400 animate-pulse' :
                  tab.status === 'awaiting_review' ? 'bg-emerald-400' :
                  tab.status === 'idle' ? 'bg-amber-400' :
                  'bg-zinc-600'
                ]" />

                <!-- Agent name -->
                <span class="text-xs font-semibold text-zinc-300 shrink-0 tracking-tight">{{ tab.agentName }}</span>

                <!-- Separator -->
                <span class="text-zinc-700 shrink-0">·</span>

                <!-- Task title -->
                <span
                  v-if="tab.taskTitle"
                  class="text-xs text-zinc-500 truncate flex-1 hover:text-violet-400 transition-colors cursor-pointer"
                  @click.stop="openTaskFromTab(tab)"
                >{{ tab.taskTitle }}</span>
                <span v-else class="text-xs text-zinc-700 flex-1 italic">No task checked out</span>

                <!-- Duration -->
                <span class="text-[11px] text-zinc-600 shrink-0 tabular-nums">{{ formatDuration(tab.startedAt) }}</span>

                <!-- Close -->
                <button
                  @click.stop="closeTerminal(tab.terminalId)"
                  title="Close terminal (⌥W)"
                  class="w-4 h-4 flex items-center justify-center rounded text-zinc-700 hover:text-red-400 transition-colors shrink-0 ml-0.5"
                >
                  <Icon name="heroicons:x-mark" class="w-3 h-3" />
                </button>
              </div>

              <!-- xterm container -->
              <div
                :ref="(el) => setTerminalRef(tab.terminalId, el as HTMLElement)"
                class="flex-1 min-h-0 bg-[#0e0e11] overflow-hidden"
              />
            </div>
          </div>
        </div>

        <!-- Launch modal -->
        <Transition name="modal">
          <div
            v-if="showLauncher"
            class="absolute inset-0 z-20 flex items-center justify-center"
          >
            <div class="absolute inset-0" @click="showLauncher = false" />
            <div class="relative w-[440px] bg-[#161619] border border-white/[0.08] rounded-2xl shadow-2xl p-6">
              <h3 class="text-white font-semibold mb-4 text-sm">Launch Terminal</h3>

              <div v-if="!launching" class="space-y-2">
                <!-- Plain terminal -->
                <button
                  @click="launchPlainTerminal"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-cyan-500/30 transition-all text-left"
                >
                  <div class="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center shrink-0">
                    <Icon name="heroicons:command-line" class="w-4 h-4 text-cyan-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-white">Plain Terminal</div>
                    <div class="text-xs text-zinc-500">Shell session in project directory</div>
                  </div>
                </button>

                <!-- Divider -->
                <div v-if="workspaceAgents.length" class="flex items-center gap-2 py-1">
                  <div class="flex-1 h-px bg-white/[0.06]" />
                  <span class="text-[10px] text-zinc-600 uppercase tracking-wider">Agents</span>
                  <div class="flex-1 h-px bg-white/[0.06]" />
                </div>

                <!-- Agent options -->
                <button
                  v-for="agent in workspaceAgents"
                  :key="agent.id"
                  @click="launchAgentTerminal(agent)"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-violet-500/30 transition-all text-left"
                >
                  <div class="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                    <Icon name="heroicons:cpu-chip" class="w-4 h-4 text-violet-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-white">{{ agent.name }}</div>
                    <div class="text-xs text-zinc-500">
                      {{ agent.runnerCommand || agent.agentProvider || 'No runner configured' }}
                      <span v-if="agent.runnerArgs" class="text-zinc-600"> {{ agent.runnerArgs }}</span>
                    </div>
                  </div>
                </button>

                <div v-if="loadingAgents" class="text-sm text-zinc-500 py-4 text-center">Loading agents…</div>
                <p v-if="!loadingAgents && !workspaceAgents.length" class="text-sm text-zinc-500 py-2 text-center">
                  No agents configured. Add one in Settings → Agents.
                </p>
              </div>

              <!-- Launching state -->
              <div v-else class="text-center py-6">
                <Icon name="heroicons:arrow-path" class="w-6 h-6 animate-spin text-violet-400 mx-auto mb-2" />
                <span class="text-sm text-zinc-300">Launching…</span>
              </div>

              <!-- Error -->
              <p v-if="launchError" class="text-xs text-red-400 mt-3">{{ launchError }}</p>
            </div>
          </div>
        </Transition>
      </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useAgentTerminals } from '~/composables/useAgentTerminals'

const {
  isOpen,
  tabs,
  activeTabId,
  launching,
  launcherDefaults,
  close,
  switchTab,
  closeTerminal,
  quickLaunch,
  connectTerminal,
} = useAgentTerminals()

const { openTask } = useTaskDetail()

function openTaskFromTab(tab: any) {
  if (tab.taskId) openTask(tab.taskId, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid layout — Hyprland-style tiling or equal columns
// ─────────────────────────────────────────────────────────────────────────────

const layoutMode = ref<'tiled' | 'columns'>('tiled')

const gridClass = computed(() => {
  const n = tabs.value.length
  if (layoutMode.value === 'columns') {
    return ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5', 'grid-cols-6'][Math.min(n, 6) - 1] ?? 'grid-cols-1'
  }
  // Tiled
  if (n <= 1) return 'grid-cols-1'
  if (n === 2) return 'grid-cols-2'
  if (n === 3) return 'grid-cols-2 grid-rows-2'  // master-stack: left full-height, right splits
  if (n === 4) return 'grid-cols-2'              // 2×2
  return 'grid-cols-3'                           // 5→ 3+2, 6→ 3×2
})

const tileClass = (index: number) => {
  if (layoutMode.value === 'tiled' && tabs.value.length === 3 && index === 0) return 'row-span-2'
  return ''
}

// ─────────────────────────────────────────────────────────────────────────────
// xterm instances
// ─────────────────────────────────────────────────────────────────────────────

const terminals = new Map<string, { term: Terminal; fit: FitAddon; lastCols?: number; lastRows?: number }>()
const terminalRefs = new Map<string, HTMLElement>()

const setTerminalRef = (terminalId: string, el: HTMLElement | null) => {
  if (el) terminalRefs.set(terminalId, el)
  else terminalRefs.delete(terminalId)
}

// Initialize terminal when a new tab appears
watch(
  () => tabs.value.length,
  async () => {
    await nextTick()
    for (const tab of tabs.value) {
      if (!terminals.has(tab.terminalId) && terminalRefs.has(tab.terminalId)) {
        initTerminal(tab.terminalId)
      }
    }
    // Re-fit all after grid reflow
    setTimeout(() => fitAllTerminals(), 100)
  }
)

// Re-attach and re-fit terminals when overlay opens (v-if recreates DOM)
watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    for (const tab of tabs.value) {
      const inst = terminals.get(tab.terminalId)
      const container = terminalRefs.get(tab.terminalId)
      if (inst && container) {
        // Reattach existing terminal instance to the new DOM container
        try { inst.term.open(container) } catch {}
      } else if (!inst && container) {
        initTerminal(tab.terminalId)
      }
    }
    for (const delay of [50, 200, 500]) {
      setTimeout(() => fitAllTerminals(), delay)
    }
  }
})

function focusTerminal(terminalId: string) {
  terminals.get(terminalId)?.term.focus()
}

function fitAllTerminals() {
  for (const [terminalId, inst] of terminals) {
    try {
      inst.fit.fit()
      if (inst.term.cols > 10) {
        inst.lastCols = inst.term.cols
        inst.lastRows = inst.term.rows
      } else if (inst.lastCols) {
        inst.term.resize(inst.lastCols, inst.lastRows!)
      }
      const tab = tabs.value.find(t => t.terminalId === terminalId)
      if (tab?.ws?.readyState === WebSocket.OPEN) {
        tab.ws.send(JSON.stringify({ type: 'resize', cols: inst.term.cols, rows: inst.term.rows }))
      }
    } catch {}
  }
}

function initTerminal(terminalId: string) {
  const container = terminalRefs.get(terminalId)
  if (!container) return

  const term = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
    lineHeight: 1.4,
    theme: {
      background: '#0e0e11',
      foreground: '#d4d4d8',
      cursor: '#a78bfa',
      cursorAccent: '#0e0e11',
      selectionBackground: '#a78bfa33',
      black: '#18181b',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#facc15',
      blue: '#60a5fa',
      magenta: '#c084fc',
      cyan: '#22d3ee',
      white: '#e4e4e7',
      brightBlack: '#3f3f46',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fde68a',
      brightBlue: '#93bbfd',
      brightMagenta: '#d8b4fe',
      brightCyan: '#67e8f9',
      brightWhite: '#fafafa',
    },
  })

  const fit = new FitAddon()
  term.loadAddon(fit)

  // Prevent xterm from consuming our app-level shortcuts
  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown' || !e.altKey) return true
    if (e.code === 'Tab' || e.code === 'KeyT' || e.code === 'KeyW') return false
    return true
  })

  term.open(container)
  requestAnimationFrame(() => fit.fit())

  const ws = connectTerminal(terminalId)
  if (!ws) {
    term.writeln('\r\n\x1b[31mFailed to connect to terminal\x1b[0m')
    terminals.set(terminalId, { term, fit })
    return
  }

  term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }))
    }
  })

  term.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })

  ws.addEventListener('message', (event) => {
    let msg: any
    try { msg = JSON.parse(event.data) } catch { return }

    if (msg.type === 'output') {
      term.write(msg.data)
    } else if (msg.type === 'buffer') {
      if (msg.lines?.length) term.write(msg.lines.join(''))
    } else if (msg.type === 'exit') {
      term.writeln(`\r\n\x1b[33m[Process exited with code ${msg.code}]\x1b[0m`)
      const tab = tabs.value.find(t => t.terminalId === terminalId)
      if (tab) tab.status = 'terminated'
    }
  })

  const resizeObserver = new ResizeObserver(() => {
    const inst = terminals.get(terminalId)
    fit.fit()
    if (term.cols > 10 && inst) {
      inst.lastCols = term.cols
      inst.lastRows = term.rows
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    } else if (inst?.lastCols) {
      term.resize(inst.lastCols, inst.lastRows!)
    }
  })
  resizeObserver.observe(container)

  terminals.set(terminalId, { term, fit })

  setTimeout(() => {
    fit.fit()
    const inst = terminals.get(terminalId)
    if (inst && term.cols > 10) {
      inst.lastCols = term.cols
      inst.lastRows = term.rows
    }
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
  }, 100)
}

// Cleanup terminals when tabs are removed
watch(
  () => tabs.value.map(t => t.terminalId),
  (current, previous) => {
    if (!previous) return
    const removed = previous.filter(id => !current.includes(id))
    for (const id of removed) {
      const inst = terminals.get(id)
      if (inst) {
        inst.term.dispose()
        terminals.delete(id)
      }
      terminalRefs.delete(id)
    }
  }
)

// ─────────────────────────────────────────────────────────────────────────────
// Launch flow
// ─────────────────────────────────────────────────────────────────────────────

const showLauncher = ref(false)
const launchError = ref('')
const launchContext = ref<{ taskId?: string }>({})

const workspaceAgents = ref<any[]>([])
const loadingAgents = ref(false)

const { workspaceId } = useItems()

const fetchWorkspaceAgents = async () => {
  if (!workspaceId.value) return
  loadingAgents.value = true
  try {
    workspaceAgents.value = await $fetch(`/api/workspaces/${workspaceId.value}/agents`)
  } catch (e) {
    console.warn('Failed to fetch agents:', e)
  } finally {
    loadingAgents.value = false
  }
}

const launchShell = async () => {
  try { await quickLaunch({ agentName: 'Terminal' }) } catch {}
}

const launchPlainTerminal = async () => {
  launchError.value = ''
  try {
    await quickLaunch({ agentName: 'Terminal', taskId: launchContext.value.taskId })
    showLauncher.value = false
    launchContext.value = {}
  } catch (e: any) {
    launchError.value = e?.data?.message || e?.message || 'Launch failed'
  }
}

const launchAgentTerminal = async (agent: any) => {
  launchError.value = ''
  try {
    await quickLaunch({ agentId: agent.id, agentName: agent.name, taskId: launchContext.value.taskId })
    showLauncher.value = false
    launchContext.value = {}
  } catch (e: any) {
    launchError.value = e?.data?.message || e?.message || 'Launch failed'
  }
}

watch(
  () => launcherDefaults.value,
  (defaults) => {
    if (!defaults.agentId && !defaults.agentName) return
    launchContext.value = { taskId: defaults.taskId }
    if (defaults.agentId) {
      launchAgentTerminal({ id: defaults.agentId, name: defaults.agentName || 'Agent' })
      return
    }
    showLauncher.value = true
  }
)

watch(showLauncher, (open) => {
  if (open) fetchWorkspaceAgents()
  else { launchError.value = ''; launchContext.value = {} }
})

// ─────────────────────────────────────────────────────────────────────────────
// Duration display
// ─────────────────────────────────────────────────────────────────────────────

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

watch(isOpen, (open) => {
  if (open) {
    now.value = Date.now()
    timer = setInterval(() => { now.value = Date.now() }, 10_000)
    fetchWorkspaceAgents()
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  for (const [, inst] of terminals) inst.term.dispose()
  terminals.clear()
})

function formatDuration(startMs: number): string {
  const diff = Math.max(0, now.value - startMs)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem ? `${hrs}h${rem}m` : `${hrs}h`
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard
// ─────────────────────────────────────────────────────────────────────────────

const handleKeydown = (e: KeyboardEvent) => {
  if (!isOpen.value) return
  if (e.key === 'Escape' && !showLauncher.value) { close(); return }
  if (e.key === 'Escape' && showLauncher.value) { showLauncher.value = false; return }
  if (!e.altKey) return

  if (e.code === 'KeyT' && tabs.value.length < 6) {
    e.preventDefault()
    launchShell()
  } else if (e.code === 'KeyW' && activeTabId.value) {
    e.preventDefault()
    closeTerminal(activeTabId.value)
  } else if (e.code === 'Tab' && tabs.value.length > 1) {
    e.preventDefault()
    const idx = tabs.value.findIndex(t => t.terminalId === activeTabId.value)
    const next = e.shiftKey
      ? tabs.value[(idx - 1 + tabs.value.length) % tabs.value.length].terminalId
      : tabs.value[(idx + 1) % tabs.value.length].terminalId
    switchTab(next)
    focusTerminal(next)
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.modal-enter-active {
  transition: all 0.15s ease-out;
}
.modal-leave-active {
  transition: all 0.1s ease-in;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
