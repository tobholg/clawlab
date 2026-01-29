import type { Item, ItemNode } from '~/types'

export function useItems() {
  // Current workspace (hardcoded for now, will come from auth/route later)
  const workspaceId = useState<string | null>('workspaceId', () => null)
  const currentScopeId = useState<string | null>('currentScope', () => null)
  const currentScopeData = useState<any>('currentScopeData', () => null)
  
  // Fetch workspace on mount
  const { data: workspaces } = useFetch('/api/workspaces')
  
  // Set workspace when loaded
  watch(workspaces, (ws) => {
    if (ws?.length && !workspaceId.value) {
      workspaceId.value = ws[0].id
    }
  }, { immediate: true })
  
  // Items data
  const itemsData = ref<any[]>([])
  const loading = ref(false)
  
  // Fetch items for current scope
  const refreshItems = async () => {
    if (!workspaceId.value) return
    
    loading.value = true
    try {
      const data = await $fetch('/api/items', {
        query: {
          workspaceId: workspaceId.value,
          parentId: currentScopeId.value ?? 'root',
        }
      })
      itemsData.value = data as any[]
    } catch (e) {
      console.error('Failed to fetch items:', e)
    } finally {
      loading.value = false
    }
  }
  
  // Fetch scope details when scope changes
  const fetchScopeDetails = async () => {
    if (!currentScopeId.value) {
      currentScopeData.value = null
      return
    }
    try {
      const data = await $fetch(`/api/items/${currentScopeId.value}`)
      currentScopeData.value = data
    } catch (e) {
      console.error('Failed to fetch scope details:', e)
      currentScopeData.value = null
    }
  }
  
  // Watch for scope changes and fetch
  watch(currentScopeId, (scopeId) => {
    if (workspaceId.value) {
      refreshItems()
      if (scopeId) fetchScopeDetails()
      else currentScopeData.value = null
    }
  })
  
  // Fetch when workspace becomes available
  watch(workspaceId, (wsId) => {
    if (wsId) {
      refreshItems()
      if (currentScopeId.value) fetchScopeDetails()
    }
  }, { immediate: true })
  
  // Transform API data to ItemNode format
  const scopedItems = computed((): ItemNode[] => {
    if (!itemsData.value) return []
    return itemsData.value.map((item: any) => ({
      ...item,
      children: item.children ?? [], // Include children from API
      depth: 0,
    }))
  })
  
  // Current scope info
  const currentScope = computed(() => {
    if (!currentScopeId.value) {
      // Root level - use workspace info
      const ws = workspaces.value?.[0]
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
    if (itemId === 'root') {
      currentScopeId.value = null
    } else {
      currentScopeId.value = itemId
    }
  }
  
  // Go up one level
  const navigateUp = () => {
    if (currentScopeData.value?.parentId) {
      currentScopeId.value = currentScopeData.value.parentId
    } else {
      currentScopeId.value = null
    }
  }
  
  // Get items by status (for Kanban columns)
  const getItemsByStatus = (status: string) => {
    return scopedItems.value.filter(item => item.status === status)
  }
  
  // Create a new item
  const createItem = async (data: Partial<Item>) => {
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
      body: data,
    })
    await refreshItems()
  }
  
  // Initial load
  watch(workspaceId, (id) => {
    if (id) {
      refreshItems()
    }
  }, { immediate: true })
  
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
