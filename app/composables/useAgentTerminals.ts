import { ref, computed, shallowRef } from 'vue'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TerminalTab {
  terminalId: string
  agentSessionId: string
  agentName: string
  taskTitle: string | null
  taskId: string | null
  status: 'active' | 'awaiting_review' | 'idle' | 'terminated'
  startedAt: number // timestamp ms
  ws: WebSocket | null
  // xterm instance stored externally by the component
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton state
// ─────────────────────────────────────────────────────────────────────────────

const isOpen = ref(false)
const tabs = ref<TerminalTab[]>([])
const activeTabId = ref<string | null>(null)
const launching = ref(false)
const launcherDefaults = ref<{
  agentName?: string
  agentId?: string
  taskTitle?: string
  taskId?: string
}>({})

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export const useAgentTerminals = () => {
  const activeTab = computed(() =>
    tabs.value.find(t => t.terminalId === activeTabId.value) ?? null
  )

  const activeCount = computed(() =>
    tabs.value.filter(t => t.status === 'active').length
  )

  const hasTerminals = computed(() => tabs.value.length > 0)

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────

  const open = () => {
    isOpen.value = true
  }

  const close = () => {
    isOpen.value = false
  }

  const toggle = () => {
    isOpen.value = !isOpen.value
  }

  const openLauncherForAgent = (
    agent: { name: string; id: string },
    context?: { taskTitle?: string; taskId?: string }
  ) => {
    launcherDefaults.value = {
      agentName: agent.name,
      agentId: agent.id,
      taskTitle: context?.taskTitle,
      taskId: context?.taskId,
    }
    isOpen.value = true
  }

  /**
   * Launch a new terminal for an agent session
   */
  const launchTerminal = async (opts: {
    agentSessionId: string
    agentToken: string
    agentName: string
    taskTitle?: string
    taskId?: string
    cwd?: string
  }) => {
    launching.value = true
    try {
      const res = await $fetch<{
        terminalId: string
        agentSessionId: string
      }>('/api/agents/terminals', {
        method: 'POST',
        body: {
          agentSessionId: opts.agentSessionId,
          agentToken: opts.agentToken,
          agentName: opts.agentName,
          cwd: opts.cwd,
        },
      })

      const tab: TerminalTab = {
        terminalId: res.terminalId,
        agentSessionId: res.agentSessionId,
        agentName: opts.agentName,
        taskTitle: opts.taskTitle ?? null,
        taskId: opts.taskId ?? null,
        status: 'active',
        startedAt: Date.now(),
        ws: null,
      }

      tabs.value.push(tab)
      activeTabId.value = tab.terminalId
      isOpen.value = true

      return tab
    } finally {
      launching.value = false
    }
  }

  /**
   * Connect a WebSocket to a terminal tab
   */
  const connectTerminal = (terminalId: string): WebSocket | null => {
    const tab = tabs.value.find(t => t.terminalId === terminalId)
    if (!tab) return null

    // Already connected
    if (tab.ws && tab.ws.readyState === WebSocket.OPEN) return tab.ws

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/_terminal`)

    ws.onopen = () => {
      // Auth (simple for now)
      ws.send(JSON.stringify({ type: 'auth', token: 'session' }))
      // Attach to terminal
      ws.send(JSON.stringify({ type: 'attach', terminalId }))
    }

    ws.onclose = () => {
      if (tab.ws === ws) {
        tab.ws = null
      }
    }

    tab.ws = ws
    return ws
  }

  /**
   * Close a terminal tab and kill the PTY
   */
  const closeTerminal = async (terminalId: string) => {
    const idx = tabs.value.findIndex(t => t.terminalId === terminalId)
    if (idx === -1) return

    const tab = tabs.value[idx]

    // Close WebSocket
    if (tab.ws) {
      tab.ws.close()
      tab.ws = null
    }

    // Kill server-side PTY
    try {
      await $fetch(`/api/agents/terminals/${terminalId}`, { method: 'DELETE' })
    } catch (e) {
      console.warn('Failed to destroy terminal:', e)
    }

    // Remove tab
    tabs.value.splice(idx, 1)

    // Switch to another tab or close overlay
    if (activeTabId.value === terminalId) {
      activeTabId.value = tabs.value[0]?.terminalId ?? null
    }

    if (!tabs.value.length) {
      isOpen.value = false
    }
  }

  /**
   * Switch active tab
   */
  const switchTab = (terminalId: string) => {
    activeTabId.value = terminalId
  }

  /**
   * Update tab status (called from WebSocket events)
   */
  const updateTabStatus = (terminalId: string, status: TerminalTab['status']) => {
    const tab = tabs.value.find(t => t.terminalId === terminalId)
    if (tab) tab.status = status
  }

  /**
   * Fetch and reconnect to existing terminals (e.g. on page reload)
   */
  const fetchExistingTerminals = async () => {
    try {
      const res = await $fetch<any[]>('/api/agents/terminals')
      for (const session of res) {
        const existing = tabs.value.find(t => t.terminalId === session.terminalId)
        if (!existing && session.terminalId) {
          tabs.value.push({
            terminalId: session.terminalId,
            agentSessionId: session.id,
            agentName: session.agent?.name ?? 'Agent',
            taskTitle: session.item?.title ?? null,
            taskId: session.itemId ?? null,
            status: session.status === 'ACTIVE' ? 'active'
              : session.status === 'AWAITING_REVIEW' ? 'awaiting_review'
              : 'idle',
            startedAt: session.checkedOutAt ? new Date(session.checkedOutAt).getTime() : Date.now(),
            ws: null,
          })
        }
      }
      if (tabs.value.length && !activeTabId.value) {
        activeTabId.value = tabs.value[0].terminalId
      }
    } catch (e) {
      console.warn('Failed to fetch existing terminals:', e)
    }
  }

  return {
    // State
    isOpen,
    tabs,
    activeTabId,
    launching,
    launcherDefaults,

    // Computed
    activeTab,
    activeCount,
    hasTerminals,

    // Actions
    open,
    close,
    toggle,
    openLauncherForAgent,
    launchTerminal,
    connectTerminal,
    closeTerminal,
    switchTab,
    updateTabStatus,
    fetchExistingTerminals,
  }
}
