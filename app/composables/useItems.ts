import type { Item, ItemNode } from '~/types'

export function useItems() {
  // Use shared workspace state from useWorkspaces composable
  const { currentWorkspaceId, currentWorkspace, fetchWorkspaces } = useWorkspaces()
  const workspaceId = currentWorkspaceId

  const currentScopeId = useState<string | null>('currentScope', () => null)
  const currentScopeData = useState<any>('currentScopeData', () => null)
  const itemsData = useState<any[]>('itemsData', () => [])
  const loading = useState('itemsLoading', () => false)

  // Get current user from auth
  const { user } = useAuth()
  const currentUserId = computed(() => user.value?.id ?? 'anonymous')

  // Request counter to handle race conditions - ignore stale responses
  const fetchCounter = useState('fetchCounter', () => 0)

  // Always fetch workspaces on mount to populate the list
  // (localStorage restores the ID but the workspace data still needs fetching)
  if (import.meta.client) {
    onMounted(() => {
      fetchWorkspaces()
    })
  }

  // Fetch items for current scope
  const refreshItems = async (force = false) => {
    if (!workspaceId.value) return

    // Increment counter and capture current request ID
    const requestId = ++fetchCounter.value

    loading.value = true
    try {
      const data = await $fetch('/api/items', {
        query: {
          workspaceId: workspaceId.value,
          parentId: currentScopeId.value ?? 'root',
        }
      })

      // Only update if this is still the latest request (ignore stale responses)
      if (requestId === fetchCounter.value) {
        itemsData.value = data as any[]
      }
    } catch (e) {
      console.error('Failed to fetch items:', e)
      // Only clear on error if this is still the latest request
      if (requestId === fetchCounter.value) {
        itemsData.value = []
      }
    } finally {
      // Only update loading if this is still the latest request
      if (requestId === fetchCounter.value) {
        loading.value = false
      }
    }
  }

  // Fetch scope details when scope changes
  const fetchScopeDetails = async (scopeId: string) => {
    try {
      const data = await $fetch(`/api/items/${scopeId}`)
      // Only update if scope hasn't changed while we were fetching
      if (currentScopeId.value === scopeId) {
        currentScopeData.value = data
      }
    } catch (e) {
      console.error('Failed to fetch scope details:', e)
      if (currentScopeId.value === scopeId) {
        currentScopeData.value = null
      }
    }
  }

  // Watch for scope changes and fetch
  watch(currentScopeId, (scopeId) => {
    if (workspaceId.value) {
      refreshItems()
      if (scopeId) {
        fetchScopeDetails(scopeId)
      } else {
        currentScopeData.value = null
      }
    }
  })

  // Reset scope when workspace actually switches (not on initial mount)
  watch(workspaceId, (wsId, oldWsId) => {
    if (wsId && oldWsId && wsId !== oldWsId) {
      currentScopeId.value = null
      currentScopeData.value = null
      refreshItems()
    }
  })

  // Transform API data to ItemNode format
  const scopedItems = computed((): ItemNode[] => {
    if (!itemsData.value) return []
    return itemsData.value.map((item: any) => ({
      ...item,
      children: item.children ?? [],
      depth: 0,
    }))
  })

  // Current scope info
  const currentScope = computed(() => {
    if (!currentScopeId.value) {
      // Root level - use workspace info
      const ws = currentWorkspace.value
      return ws ? {
        id: 'root',
        title: ws.name,
        confidence: 0,
        childrenCount: scopedItems.value.length,
      } : null
    }
    return currentScopeData.value ?? null
  })

  // Breadcrumbs from current scope
  const breadcrumbs = computed(() => {
    const root = { id: 'root', title: 'Projects' }

    if (!currentScopeData.value?.breadcrumbs) {
      return [root]
    }
    return [root, ...currentScopeData.value.breadcrumbs]
  })

  // Navigate to an item (drill down)
  const navigateTo = (itemId: string | null) => {
    const targetId = itemId === 'root' ? null : itemId

    // If already at this scope, just refresh
    if (currentScopeId.value === targetId) {
      refreshItems()
      if (targetId) fetchScopeDetails(targetId)
      return
    }

    // Clear items immediately to avoid showing stale data
    itemsData.value = []

    // Update scope - this triggers the watcher which calls refreshItems
    currentScopeId.value = targetId
  }

  // Go up one level
  const navigateUp = () => {
    if (currentScopeData.value?.parentId) {
      navigateTo(currentScopeData.value.parentId)
    } else {
      navigateTo('root')
    }
  }

  // Get items by status (for Kanban columns)
  const getItemsByStatus = (status: string) => {
    return scopedItems.value.filter(item => item.status === status)
  }

  // Create a new item
  const createItem = async (data: Partial<Item> & { ownerId?: string | null; assigneeIds?: string[]; complexity?: string | null; priority?: string | null; agentMode?: 'PLAN' | 'EXECUTE' | null }) => {
    await $fetch('/api/items', {
      method: 'POST',
      body: {
        workspaceId: workspaceId.value,
        parentId: currentScopeId.value,
        ...data,
      }
    })
    await refreshItems()
  }

  // Update an item
  const updateItem = async (id: string, data: Partial<Item>) => {
    await $fetch(`/api/items/${id}`, {
      method: 'PATCH',
      body: {
        ...data,
        userId: currentUserId.value,
      },
    })
    await refreshItems()
  }

  return {
    workspaceId,
    currentScope,
    currentScopeId,
    scopedItems,
    breadcrumbs,
    loading,
    navigateTo,
    navigateUp,
    getItemsByStatus,
    createItem,
    updateItem,
    refreshItems,
  }
}
