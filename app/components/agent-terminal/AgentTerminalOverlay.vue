<template>
  <Teleport to="body">
    <div
      v-show="isOpen"
      class="fixed inset-0 z-40 flex flex-col transition-opacity duration-200"
      :class="isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/80 backdrop-blur-sm"
          @click="close"
        >
        </div>

        <!-- Overlay content -->
        <div class="relative z-10 flex flex-col h-full p-6 pt-16 pb-20">
          <!-- Header -->
          <div class="flex items-center justify-between mb-4 px-2">
            <div class="flex items-center gap-3">
              <Icon name="heroicons:command-line" class="w-5 h-5 text-violet-400" />
              <h2 class="text-lg font-medium text-white">Command Central</h2>
              <span
                v-if="activeCount > 0"
                class="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"
              >
                {{ activeCount }} active
              </span>
            </div>
            <div class="flex items-center gap-2">
              <!-- Launch new terminal button -->
              <button
                @click="showLauncher = true"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 transition-colors"
              >
                <Icon name="heroicons:plus" class="w-4 h-4" />
                Launch
              </button>
              <button
                @click="close"
                class="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Tabs -->
          <div
            v-if="tabs.length"
            class="flex items-center gap-1 mb-3 px-2 overflow-x-auto"
          >
            <div
              v-for="tab in tabs"
              :key="tab.terminalId"
              @click="switchTab(tab.terminalId)"
              :class="[
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all duration-150 shrink-0 group cursor-pointer',
                activeTabId === tab.terminalId
                  ? 'bg-white/[0.1] text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]'
              ]"
            >
              <!-- Status dot -->
              <span :class="[
                'w-2 h-2 rounded-full shrink-0',
                tab.status === 'active' ? 'bg-emerald-400 animate-pulse' :
                tab.status === 'awaiting_review' ? 'bg-emerald-400' :
                tab.status === 'idle' ? 'bg-amber-400' :
                'bg-zinc-500'
              ]" />

              <span class="font-medium">{{ tab.agentName }}</span>
              <span v-if="tab.taskTitle" class="text-zinc-500 max-w-[150px] truncate">
                · {{ tab.taskTitle }}
              </span>
              <span class="text-zinc-600 text-xs">
                {{ formatDuration(tab.startedAt) }}
              </span>

              <!-- Close tab button -->
              <button
                @click.stop="closeTerminal(tab.terminalId)"
                class="w-4 h-4 flex items-center justify-center rounded text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Icon name="heroicons:x-mark" class="w-3 h-3" />
              </button>
            </div>
          </div>

          <!-- Terminal container -->
          <div class="flex-1 min-h-0 rounded-xl overflow-hidden border border-white/[0.06] bg-[#0e0e11]">
            <!-- Empty state -->
            <div
              v-if="!tabs.length"
              class="h-full flex items-center justify-center"
            >
              <div class="text-center">
                <Icon name="heroicons:command-line" class="w-12 h-12 text-zinc-700 mx-auto mb-3" />
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

            <!-- xterm.js containers (one per tab, show/hide) -->
            <div
              v-for="tab in tabs"
              :key="tab.terminalId"
              :ref="(el) => setTerminalRef(tab.terminalId, el as HTMLElement)"
              v-show="activeTabId === tab.terminalId"
              class="h-full w-full"
            />
          </div>
        </div>

        <!-- Launch modal -->
        <Transition name="modal">
          <div
            v-if="showLauncher"
            class="absolute inset-0 z-20 flex items-center justify-center"
          >
            <div class="absolute inset-0" @click="showLauncher = false"></div>
            <div class="relative w-[440px] bg-[#161619] border border-white/[0.06] rounded-2xl shadow-2xl p-6">
              <h3 class="text-white font-medium mb-4">Launch Terminal</h3>

              <div v-if="!launching" class="space-y-2">
                <!-- Plain terminal option -->
                <button
                  @click="launchPlainTerminal"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-cyan-500/30 transition-all text-left"
                >
                  <div class="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                    <Icon name="heroicons:command-line" class="w-4 h-4 text-cyan-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-white">Plain Terminal</div>
                    <div class="text-xs text-zinc-500">Shell session in project directory</div>
                  </div>
                </button>

                <!-- Divider -->
                <div v-if="workspaceAgents.length" class="flex items-center gap-2 py-1">
                  <div class="flex-1 h-px bg-white/[0.06]"></div>
                  <span class="text-[10px] text-zinc-600 uppercase tracking-wider">Agents</span>
                  <div class="flex-1 h-px bg-white/[0.06]"></div>
                </div>

                <!-- Agent options -->
                <button
                  v-for="agent in workspaceAgents"
                  :key="agent.id"
                  @click="launchAgentTerminal(agent)"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-violet-500/30 transition-all text-left"
                >
                  <div class="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                    <Icon name="heroicons:cpu-chip" class="w-4 h-4 text-violet-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-medium text-white">{{ agent.name }}</div>
                    <div class="text-xs text-zinc-500">
                      {{ agent.runnerCommand || agent.agentProvider || 'No runner configured' }}
                      <span v-if="agent.runnerArgs" class="text-zinc-600">{{ agent.runnerArgs }}</span>
                    </div>
                  </div>
                </button>

                <div v-if="loadingAgents" class="text-sm text-zinc-500 py-4 text-center">Loading agents...</div>
                <p v-if="!loadingAgents && !workspaceAgents.length" class="text-sm text-zinc-500 py-2 text-center">
                  No agents configured. Add one in Settings → Agents.
                </p>
              </div>

              <!-- Launching state -->
              <div v-else class="text-center py-6">
                <Icon name="heroicons:arrow-path" class="w-6 h-6 animate-spin text-violet-400 mx-auto mb-2" />
                <span class="text-sm text-zinc-300">Launching...</span>
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
  activeCount,
  close,
  switchTab,
  closeTerminal,
  quickLaunch,
  connectTerminal,
} = useAgentTerminals()

// ─────────────────────────────────────────────────────────────────────────────
// xterm instances
// ─────────────────────────────────────────────────────────────────────────────

const terminals = new Map<string, { term: Terminal; fit: FitAddon }>()
const terminalRefs = new Map<string, HTMLElement>()

const setTerminalRef = (terminalId: string, el: HTMLElement | null) => {
  if (el) {
    terminalRefs.set(terminalId, el)
  }
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
  }
)

// Re-fit when switching tabs
watch(activeTabId, async () => {
  await nextTick()
  if (activeTabId.value) {
    const inst = terminals.get(activeTabId.value)
    if (inst) {
      inst.fit.fit()
    }
  }
})

// Re-fit all terminals when overlay opens
watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    // Fit at multiple intervals to catch layout settling
    for (const delay of [50, 200, 500]) {
      setTimeout(() => fitAllTerminals(), delay)
    }
  }
})

function fitAllTerminals() {
  for (const [terminalId, inst] of terminals) {
    try {
      inst.fit.fit()
      // Send resize to PTY via WebSocket
      const tab = tabs.value.find(t => t.terminalId === terminalId)
      if (tab?.ws?.readyState === WebSocket.OPEN) {
        tab.ws.send(JSON.stringify({
          type: 'resize',
          cols: inst.term.cols,
          rows: inst.term.rows,
        }))
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
  term.open(container)

  // Fit after open
  requestAnimationFrame(() => fit.fit())

  // Connect WebSocket
  const ws = connectTerminal(terminalId)
  if (!ws) {
    term.writeln('\r\n\x1b[31mFailed to connect to terminal\x1b[0m')
    terminals.set(terminalId, { term, fit })
    return
  }

  // Terminal input → WebSocket
  term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }))
    }
  })

  // Terminal resize → WebSocket
  term.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }))
    }
  })

  // WebSocket → Terminal
  ws.addEventListener('message', (event) => {
    let msg: any
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }

    if (msg.type === 'output') {
      term.write(msg.data)
    } else if (msg.type === 'buffer') {
      // Reconnect buffer
      if (msg.lines?.length) {
        term.write(msg.lines.join(''))
      }
    } else if (msg.type === 'exit') {
      term.writeln(`\r\n\x1b[33m[Process exited with code ${msg.code}]\x1b[0m`)
      const tab = tabs.value.find(t => t.terminalId === terminalId)
      if (tab) tab.status = 'terminated'
    }
  })

  // Handle resize observer for container
  const resizeObserver = new ResizeObserver(() => {
    fit.fit()
    // Also notify PTY of new size
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
  })
  resizeObserver.observe(container)

  // Initial fit with delay to ensure container is fully laid out
  setTimeout(() => {
    fit.fit()
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }
  }, 100)

  terminals.set(terminalId, { term, fit })
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

// Workspace agents
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

const launchPlainTerminal = async () => {
  launchError.value = ''
  try {
    await quickLaunch({
      agentName: 'Terminal',
      taskId: launchContext.value.taskId,
    })
    showLauncher.value = false
    launchContext.value = {}
  } catch (e: any) {
    launchError.value = e?.data?.message || e?.message || 'Launch failed'
  }
}

const launchAgentTerminal = async (agent: any) => {
  launchError.value = ''
  try {
    await quickLaunch({
      agentId: agent.id,
      agentName: agent.name,
      taskId: launchContext.value.taskId,
    })
    showLauncher.value = false
    launchContext.value = {}
  } catch (e: any) {
    launchError.value = e?.data?.message || e?.message || 'Launch failed'
  }
}

// Watch for launcher defaults (from "Launch Terminal" buttons)
watch(
  () => launcherDefaults.value,
  (defaults) => {
    if (!defaults.agentId && !defaults.agentName) return

    launchContext.value = { taskId: defaults.taskId }

    if (defaults.agentId) {
      // Direct launch - skip the picker
      launchAgentTerminal({ id: defaults.agentId, name: defaults.agentName || 'Agent' })
      return
    }

    showLauncher.value = true
  }
)

// Fetch agents when launcher opens
watch(showLauncher, (open) => {
  if (open) {
    fetchWorkspaceAgents()
  } else {
    launchError.value = ''
    launchContext.value = {}
  }
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
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  // Dispose all terminals
  for (const [, inst] of terminals) {
    inst.term.dispose()
  }
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
// Keyboard shortcut: Escape to close
// ─────────────────────────────────────────────────────────────────────────────

const handleKeydown = (e: KeyboardEvent) => {
  // Only close on Escape if launcher is not open
  if (e.key === 'Escape' && isOpen.value && !showLauncher.value) {
    close()
  } else if (e.key === 'Escape' && showLauncher.value) {
    showLauncher.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
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
