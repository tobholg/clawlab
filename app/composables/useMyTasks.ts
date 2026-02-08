export function useMyTasks() {
  const { currentWorkspaceId } = useWorkspaces()

  const groups = useState<any[]>('myTasksGroups', () => [])
  const totalCount = useState('myTasksTotalCount', () => 0)
  const activeCount = useState('myTasksActiveCount', () => 0)
  const loading = useState('myTasksLoading', () => false)
  const statusFilter = useState<'active' | 'done' | 'all'>('myTasksStatusFilter', () => 'active')
  const sortBy = useState<'updatedAt' | 'dueDate' | 'status'>('myTasksSortBy', () => 'updatedAt')

  const allTasks = computed(() => groups.value.flatMap((g: any) => g.tasks))

  const sidebarPreview = computed(() => {
    return allTasks.value
      .slice()
      .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 3)
  })

  const fetchMyTasks = async () => {
    if (!currentWorkspaceId.value) return
    loading.value = true
    try {
      const data = await $fetch('/api/items/my-tasks', {
        query: {
          workspaceId: currentWorkspaceId.value,
          status: statusFilter.value,
          sort: sortBy.value,
        },
      }) as any
      groups.value = data.groups
      totalCount.value = data.totalCount
      activeCount.value = data.activeCount
    } catch (e) {
      console.error('Failed to fetch my tasks:', e)
    } finally {
      loading.value = false
    }
  }

  // Auto-refetch on workspace/filter changes
  watch([currentWorkspaceId, statusFilter, sortBy], () => {
    if (currentWorkspaceId.value) fetchMyTasks()
  }, { immediate: true })

  const hasMoreTasks = computed(() => allTasks.value.length > 3)

  return {
    groups,
    totalCount,
    activeCount,
    loading,
    statusFilter,
    sortBy,
    allTasks,
    sidebarPreview,
    hasMoreTasks,
    fetchMyTasks,
  }
}
