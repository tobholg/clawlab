type SectionKey = 'focus' | 'projects' | 'myTasks' | 'channels' | 'workspace'

const STORAGE_KEY = 'sidebar-sections-collapsed'

export function useSidebarSections() {
  const collapsed = useState<Record<SectionKey, boolean>>('sidebarSectionsCollapsed', () => ({
    focus: false,
    projects: false,
    myTasks: false,
    channels: false,
    workspace: false,
  }))

  // Load from localStorage on client
  if (import.meta.client) {
    onMounted(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          collapsed.value = { ...collapsed.value, ...parsed }
        }
      } catch {}
    })
  }

  const persist = () => {
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed.value))
      } catch {}
    }
  }

  const toggleSection = (key: SectionKey) => {
    collapsed.value[key] = !collapsed.value[key]
    persist()
  }

  const isSectionCollapsed = (key: SectionKey) => collapsed.value[key]

  return { toggleSection, isSectionCollapsed }
}
