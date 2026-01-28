export function useFocus() {
  // Current user ID (hardcoded for now, will come from auth)
  const currentUserId = useState<string>('currentUserId', () => 'demo-user')
  
  // Current focus state
  const currentFocus = useState<{
    itemId: string
    itemTitle: string
    startedAt: Date
  } | null>('currentFocus', () => null)
  
  const isLoading = ref(false)
  
  // Load current focus on init
  const loadCurrentFocus = async () => {
    try {
      const user = await $fetch(`/api/users/${currentUserId.value}`)
      if (user?.currentFocusItemId) {
        const item = await $fetch(`/api/items/${user.currentFocusItemId}`)
        currentFocus.value = {
          itemId: user.currentFocusItemId,
          itemTitle: item?.title ?? 'Unknown',
          startedAt: new Date(user.currentFocusStartedAt),
        }
      }
    } catch (e) {
      // User might not exist yet in demo mode
      console.log('No current focus loaded')
    }
  }
  
  // Start focus on an item
  const startFocus = async (itemId: string, itemTitle: string) => {
    isLoading.value = true
    try {
      const result = await $fetch('/api/focus/set', {
        method: 'POST',
        body: {
          userId: currentUserId.value,
          itemId,
        }
      })
      
      currentFocus.value = {
        itemId,
        itemTitle,
        startedAt: new Date(result.startedAt),
      }
    } catch (e) {
      console.error('Failed to start focus:', e)
      throw e
    } finally {
      isLoading.value = false
    }
  }
  
  // Clear current focus
  const clearFocus = async () => {
    isLoading.value = true
    try {
      await $fetch('/api/focus/clear', {
        method: 'POST',
        body: {
          userId: currentUserId.value,
        }
      })
      currentFocus.value = null
    } catch (e) {
      console.error('Failed to clear focus:', e)
      throw e
    } finally {
      isLoading.value = false
    }
  }
  
  // Check if currently focused on an item
  const isFocusedOn = (itemId: string) => {
    return currentFocus.value?.itemId === itemId
  }
  
  // Get focus duration in a readable format
  const focusDuration = computed(() => {
    if (!currentFocus.value) return null
    
    const now = new Date()
    const started = new Date(currentFocus.value.startedAt)
    const diffMs = now.getTime() - started.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 60) {
      return `${diffMins}m`
    }
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  })
  
  return {
    currentUserId,
    currentFocus,
    isLoading,
    loadCurrentFocus,
    startFocus,
    clearFocus,
    isFocusedOn,
    focusDuration,
  }
}
