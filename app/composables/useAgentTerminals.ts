import { computed, ref } from 'vue'

export const GLOBAL_SCOPE_ID = 'global'
export const MAX_TERMINALS_PER_SCOPE = 6
export const MAX_TERMINALS_TOTAL = 24

function scopeIdForProject(projectId?: string | null) {
  return projectId ? `project:${projectId}` : GLOBAL_SCOPE_ID
}

function projectIdFromScope(scopeId: string): string | null {
  if (!scopeId.startsWith('project:')) return null
  return scopeId.slice('project:'.length) || null
}

function mapSessionStatus(status: string): TerminalTab['status'] {
  if (status === 'ACTIVE') return 'active'
  if (status === 'AWAITING_REVIEW') return 'awaiting_review'
  if (status === 'TERMINATED') return 'terminated'
  return 'idle'
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TerminalTab {
  terminalId: string
  agentSessionId: string
  agentId: string
  agentName: string
  isPlainTerminal: boolean
  taskTitle: string | null
  taskId: string | null
  projectId: string | null
  projectTitle: string | null
  scopeId: string
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
const selectedScopeId = ref<string>(GLOBAL_SCOPE_ID)
const scopedActiveTabIds = ref<Record<string, string | null>>({ [GLOBAL_SCOPE_ID]: null })
const launching = ref(false)
const launcherDefaults = ref<{
  agentName?: string
  agentId?: string
  taskTitle?: string
  taskId?: string
  projectId?: string
}>({})

function ensureScope(scopeId: string) {
  if (scopeId in scopedActiveTabIds.value) return
  scopedActiveTabIds.value = {
    ...scopedActiveTabIds.value,
    [scopeId]: null,
  }
}

function setScopeActiveTab(scopeId: string, terminalId: string | null) {
  ensureScope(scopeId)
  scopedActiveTabIds.value = {
    ...scopedActiveTabIds.value,
    [scopeId]: terminalId,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composable
// ─────────────────────────────────────────────────────────────────────────────

export const useAgentTerminals = () => {
  const activeTabId = computed<string | null>({
    get() {
      ensureScope(selectedScopeId.value)
      return scopedActiveTabIds.value[selectedScopeId.value] ?? null
    },
    set(value) {
      setScopeActiveTab(selectedScopeId.value, value)
    },
  })

  const activeTab = computed(() =>
    tabs.value.find(t => t.terminalId === activeTabId.value) ?? null
  )

  const activeCount = computed(() =>
    tabs.value.filter(t => t.status === 'active').length
  )

  const hasTerminals = computed(() => tabs.value.length > 0)
  const totalOpenCount = computed(() => tabs.value.length)
  const scopeOpenCount = computed(() => tabs.value.filter(t => t.scopeId === selectedScopeId.value).length)
  const canLaunchInSelectedScope = computed(() => (
    scopeOpenCount.value < MAX_TERMINALS_PER_SCOPE && totalOpenCount.value < MAX_TERMINALS_TOTAL
  ))

  const getTabsForScope = (scopeId: string) => tabs.value.filter(t => t.scopeId === scopeId)

  const setSelectedScope = (scopeId: string) => {
    ensureScope(scopeId)
    selectedScopeId.value = scopeId
  }

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
    context?: { taskTitle?: string; taskId?: string; projectId?: string }
  ) => {
    launcherDefaults.value = {
      agentName: agent.name,
      agentId: agent.id,
      taskTitle: context?.taskTitle,
      taskId: context?.taskId,
      projectId: context?.projectId,
    }
    isOpen.value = true
  }

  /**
   * One-click launch. Server reads token from DB.
   * agentId = agent terminal with runner bootstrap
   * no agentId = plain terminal
   */
  const quickLaunch = async (opts: {
    agentId?: string
    agentName?: string
    taskId?: string
    projectId?: string
    cwd?: string
  }) => {
    launching.value = true
    try {
      const res = await $fetch<{
        terminalId: string
        agentSessionId: string | null
        agentName: string
        taskTitle: string | null
        taskId: string | null
        projectId: string | null
        projectTitle: string | null
        isPlainTerminal: boolean
        reused: boolean
      }>('/api/agents/terminals/launch', {
        method: 'POST',
        body: {
          agentId: opts.agentId,
          taskId: opts.taskId,
          projectId: opts.projectId,
          cwd: opts.cwd,
        },
      })

      // Don't add duplicate tab if reused
      const existing = tabs.value.find(t => t.terminalId === res.terminalId)
      if (existing) {
        setSelectedScope(existing.scopeId)
        setScopeActiveTab(existing.scopeId, existing.terminalId)
        isOpen.value = true
        return existing
      }

      const projectId = res.projectId ?? null
      const scopeId = scopeIdForProject(projectId)
      const tab: TerminalTab = {
        terminalId: res.terminalId,
        agentSessionId: res.agentSessionId ?? res.terminalId,
        agentId: opts.agentId || '',
        agentName: res.agentName || opts.agentName || 'Terminal',
        isPlainTerminal: res.isPlainTerminal,
        taskTitle: res.taskTitle,
        taskId: res.taskId,
        projectId,
        projectTitle: res.projectTitle ?? null,
        scopeId,
        status: 'active',
        startedAt: Date.now(),
        ws: null,
      }

      tabs.value.push(tab)
      setSelectedScope(scopeId)
      setScopeActiveTab(scopeId, tab.terminalId)
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
    if (!tab) return

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

    // Maintain active tab per scope
    if (scopedActiveTabIds.value[tab.scopeId] === terminalId) {
      const nextInScope = tabs.value.find(t => t.scopeId === tab.scopeId)?.terminalId ?? null
      setScopeActiveTab(tab.scopeId, nextInScope)
    }
  }

  /**
   * Switch active tab
   */
  const switchTab = (terminalId: string) => {
    const tab = tabs.value.find(t => t.terminalId === terminalId)
    if (!tab) return
    setSelectedScope(tab.scopeId)
    setScopeActiveTab(tab.scopeId, terminalId)
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
          const projectId = session.project?.id ?? null
          const scopeId = scopeIdForProject(projectId)
          tabs.value.push({
            terminalId: session.terminalId,
            agentSessionId: session.agentSessionId ?? session.terminalId,
            agentId: session.agent?.id ?? '',
            agentName: session.agent?.name ?? 'Agent',
            isPlainTerminal: false,
            taskTitle: session.task?.title ?? null,
            taskId: session.task?.id ?? null,
            projectId,
            projectTitle: session.project?.title ?? null,
            scopeId,
            status: mapSessionStatus(session.status),
            startedAt: session.checkedOutAt
              ? new Date(session.checkedOutAt).getTime()
              : session.createdAt
                ? new Date(session.createdAt).getTime()
                : Date.now(),
            ws: null,
          })

          if (!scopedActiveTabIds.value[scopeId]) {
            setScopeActiveTab(scopeId, session.terminalId)
          }
        }
      }

      const selectedActiveTab = scopedActiveTabIds.value[selectedScopeId.value]
      if (!selectedActiveTab) {
        const firstInSelected = tabs.value.find(t => t.scopeId === selectedScopeId.value)
        if (firstInSelected) {
          setScopeActiveTab(selectedScopeId.value, firstInSelected.terminalId)
        }
      }
    } catch (e) {
      console.warn('Failed to fetch existing terminals:', e)
    }
  }

  function updateTabFromSession(data: { agentId?: string; terminalId?: string; sessionId?: string; taskId?: string; taskTitle?: string; status?: string }) {
    for (const tab of tabs.value) {
      const match = (data.terminalId && tab.terminalId === data.terminalId)
        || (data.sessionId && tab.agentSessionId === data.sessionId)
        || (data.agentId && tab.agentId === data.agentId) // fallback: match by agent
      if (!match) continue

      if (data.taskId !== undefined) tab.taskId = data.taskId || null
      if (data.taskTitle !== undefined) tab.taskTitle = data.taskTitle || null
      if (data.status) {
        const s = data.status.toLowerCase()
        if (s === 'active' || s === 'awaiting_review' || s === 'idle' || s === 'terminated') {
          tab.status = s
          // Clear task info when session goes idle
          if (s === 'idle') {
            tab.taskId = null
            tab.taskTitle = null
          }
        }
      }
    }
  }

  return {
    // Limits
    MAX_TERMINALS_PER_SCOPE,
    MAX_TERMINALS_TOTAL,

    // Scope helpers
    GLOBAL_SCOPE_ID,
    projectIdFromScope,

    // State
    isOpen,
    tabs,
    selectedScopeId,
    activeTabId,
    launching,
    launcherDefaults,

    // Computed
    activeTab,
    activeCount,
    hasTerminals,
    totalOpenCount,
    scopeOpenCount,
    canLaunchInSelectedScope,

    // Actions
    open,
    close,
    toggle,
    setSelectedScope,
    getTabsForScope,
    openLauncherForAgent,
    quickLaunch,
    connectTerminal,
    closeTerminal,
    switchTab,
    updateTabStatus,
    updateTabFromSession,
    fetchExistingTerminals,
  }
}
