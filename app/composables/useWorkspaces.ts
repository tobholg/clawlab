export type WorkspaceInfo = {
  id: string
  name: string
  slug: string
  description: string | null
  organizationId: string
  organizationName: string
  itemCount: number
  memberCount: number
  createdAt: string
}

export type WorkspaceMembership = {
  workspaceId: string
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  orgRole: 'OWNER' | 'ADMIN' | 'MEMBER'
  isOrgAdmin: boolean
  isWorkspaceAdmin: boolean
}

export function useWorkspaces() {
  // Shared state across all components
  const workspaces = useState<WorkspaceInfo[]>('workspacesList', () => [])
  const currentWorkspaceId = useState<string | null>('workspaceId', () => null)

  // Restore from localStorage after hydration (useState initializer only runs on server where there's no localStorage)
  if (import.meta.client && !currentWorkspaceId.value) {
    const stored = localStorage.getItem('currentWorkspaceId')
    if (stored) currentWorkspaceId.value = stored
  }
  const membership = useState<WorkspaceMembership | null>('workspaceMembership', () => null)
  const loading = useState('workspacesLoading', () => false)

  const currentWorkspace = computed(() =>
    workspaces.value.find(ws => ws.id === currentWorkspaceId.value) ?? null
  )

  const currentRole = computed(() => membership.value?.role ?? null)
  const isWorkspaceAdmin = computed(() => membership.value?.isWorkspaceAdmin ?? false)
  const isOrgAdmin = computed(() => membership.value?.isOrgAdmin ?? false)

  const fetchWorkspaces = async () => {
    loading.value = true
    try {
      const data = await $fetch<WorkspaceInfo[]>('/api/workspaces')
      workspaces.value = data

      // Auto-select first workspace if none selected, or validate stored ID
      if (data.length > 0) {
        if (!currentWorkspaceId.value || !data.find(ws => ws.id === currentWorkspaceId.value)) {
          currentWorkspaceId.value = data[0].id
        }
      }
    } catch (e) {
      console.error('Failed to fetch workspaces:', e)
    } finally {
      loading.value = false
    }
  }

  const fetchMembership = async () => {
    if (!currentWorkspaceId.value) {
      membership.value = null
      return
    }
    try {
      const data = await $fetch<WorkspaceMembership>('/api/workspaces/membership', {
        query: { workspaceId: currentWorkspaceId.value },
      })
      membership.value = data
    } catch (e) {
      console.error('Failed to fetch membership:', e)
      membership.value = null
    }
  }

  const switchWorkspace = (id: string) => {
    if (id === currentWorkspaceId.value) return
    currentWorkspaceId.value = id
  }

  const createWorkspace = async (data: { name: string; description?: string; organizationId: string }) => {
    const ws = await $fetch<WorkspaceInfo>('/api/workspaces', {
      method: 'POST',
      body: data,
    })
    workspaces.value = [ws, ...workspaces.value]
    switchWorkspace(ws.id)
    return ws
  }

  // Refetch membership when workspace changes + persist to localStorage
  watch(currentWorkspaceId, (id) => {
    fetchMembership()
    if (import.meta.client) {
      if (id) {
        localStorage.setItem('currentWorkspaceId', id)
      } else {
        localStorage.removeItem('currentWorkspaceId')
      }
    }
  })

  // Ensure membership is fetched on init if workspaceId was restored from localStorage
  // (the watcher above only fires on future changes, not for the value set before registration)
  if (import.meta.client && currentWorkspaceId.value && !membership.value) {
    fetchMembership()
  }

  return {
    workspaces,
    currentWorkspaceId,
    currentWorkspace,
    membership,
    currentRole,
    isWorkspaceAdmin,
    isOrgAdmin,
    loading,
    fetchWorkspaces,
    fetchMembership,
    switchWorkspace,
    createWorkspace,
  }
}
