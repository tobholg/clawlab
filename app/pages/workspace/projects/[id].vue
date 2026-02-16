<script setup lang="ts">
import { CATEGORY_COLORS, PRIORITY_OPTIONS, COMPLEXITY_OPTIONS } from '~/types'

definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const router = useRouter()

const projectId = computed(() => route.params.id as string)

const {
  scopedItems,
  currentScope,
  breadcrumbs,
  navigateTo,
  navigateUp,
  createItem,
  updateItem,
  refreshItems,
  workspaceId,
  currentScopeId,
} = useItems()

const { currentRole } = useWorkspaces()
const canCreate = computed(() => currentRole.value !== 'VIEWER')
const { onOpenTask } = useTaskDetail()

// Navigate to this project when route changes or on mount
// navigateTo handles the case where we're already at this scope
watch(projectId, (id) => {
  if (id) {
    navigateTo(id)
  }
}, { immediate: true })

const activeView = ref<'kanban' | 'timeline' | 'list' | 'documents' | 'external' | 'inbound'>('kanban')
const viewSwitchPulse = ref(false)
const inboundQueueRef = ref<any>(null)

// Check if this is a root project (can have external spaces)
const isRootProject = computed(() => breadcrumbs.value.length <= 2)
const filterCategory = ref<string | null>(null)
const filterPriority = ref<string | null>(null)
const filterComplexity = ref<string | null>(null)
const searchQuery = ref('')
const showSuggestedWorkOrder = ref(false)
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const selectedItem = ref<any>(null)
const documentsSectionRef = ref<any>(null)
const attentionPaneOpen = ref(false)
const attentionPaneMode = ref<'at-risk' | 'blocked'>('at-risk')
const attentionPaneRoot = ref<any>(null)
const showDocsModal = ref(false)
const docsItem = ref<any>(null)
const showArchiveModal = ref(false)
const showCompleteWithChildren = ref(false)
const completeWithChildrenLoading = ref(false)
const completeWithChildrenError = ref<string | null>(null)
const pendingCompleteItem = ref<any>(null)
const editingTitle = ref(false)
const editingDescription = ref(false)

// Header assignee tooltip
const headerTooltipAssignee = ref<{ id: string; name: string } | null>(null)
const headerTooltipPos = ref({ top: 0, left: 0 })

const onHeaderAssigneeEnter = (assignee: { id: string; name: string }, e: MouseEvent) => {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  headerTooltipPos.value = {
    top: rect.bottom + 8,
    left: rect.left + rect.width / 2,
  }
  headerTooltipAssignee.value = assignee
}

const onHeaderAssigneeLeave = () => {
  headerTooltipAssignee.value = null
}
const titleInputRef = ref<HTMLInputElement | null>(null)
const descriptionRef = ref<HTMLTextAreaElement | null>(null)
const descriptionNeedsTruncation = computed(() => {
  const desc = editedProjectDescription.value
  if (!desc) return false
  return desc.length > 100 || desc.includes('\n')
})

const createDocumentFromHeader = async () => {
  if (activeView.value !== 'documents') return
  documentsSectionRef.value?.createDocument?.()
}

// View options configuration
const viewOptions = computed(() => {
  const base = [
    { key: 'kanban', icon: 'heroicons:view-columns', label: 'Kanban', shortcut: 'K' },
    { key: 'timeline', icon: 'heroicons:calendar', label: 'Timeline', shortcut: 'T' },
    { key: 'list', icon: 'heroicons:bars-3', label: 'List', shortcut: 'L' },
    { key: 'documents', icon: 'heroicons:document-text', label: 'Documents', shortcut: 'D' },
  ]
  if (isRootProject.value) {
    base.push(
      { key: 'external', icon: 'heroicons:globe-alt', label: 'External', shortcut: 'E' },
      { key: 'inbound', icon: 'heroicons:inbox-arrow-down', label: 'Inbound', shortcut: 'I' }
    )
  }
  return base
})

const activeViewOption = computed(() => {
  return viewOptions.value.find(v => v.key === activeView.value) || viewOptions.value[0]
})

// Get sidebar refresh function from layout (must be called at top level)
const refreshSidebar = inject<() => Promise<void>>('refreshSidebarProjects')

// Project-level editing state
const editedProjectTitle = ref('')
const editedProjectDescription = ref('')
const projectSaveTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const isProjectInitializing = ref(true)

// Load project data when scope changes
watch(currentScope, (scope) => {
  isProjectInitializing.value = true
  editingTitle.value = false
  editingDescription.value = false
  if (scope && scope.id !== 'root') {
    editedProjectTitle.value = scope.title ?? ''
    editedProjectDescription.value = scope.description ?? ''
  }
  nextTick(() => {
    isProjectInitializing.value = false
  })
}, { immediate: true })

// Auto-save project changes
const saveProjectChanges = async () => {
  if (!currentScope.value || currentScope.value.id === 'root') return

  try {
    await $fetch(`/api/items/${currentScope.value.id}`, {
      method: 'PATCH',
      body: {
        title: editedProjectTitle.value,
        description: editedProjectDescription.value,
      }
    })
    await refreshItems()
    // Refresh sidebar projects
    if (refreshSidebar) refreshSidebar()
  } catch (e) {
    console.error('Failed to save project:', e)
  }
}

const debouncedProjectSave = () => {
  if (projectSaveTimeout.value) clearTimeout(projectSaveTimeout.value)
  projectSaveTimeout.value = setTimeout(saveProjectChanges, 500)
}

// Watch project fields for auto-save
watch([editedProjectTitle, editedProjectDescription], () => {
  if (currentScope.value && currentScope.value.id !== 'root' && !isProjectInitializing.value) {
    debouncedProjectSave()
  }
})

// Get unique categories from current scope
const baseCategories = Object.keys(CATEGORY_COLORS)
const categories = computed(() => {
  const extra = new Set<string>()
  scopedItems.value.forEach(item => {
    if (item.category && !baseCategories.includes(item.category)) {
      extra.add(item.category)
    }
  })
  return [...baseCategories, ...Array.from(extra)]
})

const categoryDotColors: Record<string, string> = {
  Engineering: 'bg-blue-500',
  Bug: 'bg-rose-500',
  Design: 'bg-violet-500',
  Product: 'bg-indigo-500',
  QA: 'bg-amber-500',
  Research: 'bg-cyan-500',
  Operations: 'bg-orange-500',
  Marketing: 'bg-pink-500',
}

const priorityDotColors: Record<string, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-rose-500',
}

const complexityDotColors: Record<string, string> = {
  TRIVIAL: 'bg-emerald-500',
  SMALL: 'bg-green-500',
  MEDIUM: 'bg-amber-500',
  LARGE: 'bg-orange-500',
  EPIC: 'bg-rose-500',
}

const priorityLabel = computed(() => {
  return PRIORITY_OPTIONS.find(opt => opt.value === filterPriority.value)?.label ?? 'Priority'
})

const complexityLabel = computed(() => {
  if (!filterComplexity.value) return 'Complexity'
  if (filterComplexity.value === 'NONE') return 'No complexity'
  return COMPLEXITY_OPTIONS.find(opt => opt.value === filterComplexity.value)?.label ?? 'Complexity'
})

// Filter items
const normalizeFilter = (value: string | null) => {
  if (!value || value === 'null') return null
  return value
}

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const categoryValue = normalizeFilter(filterCategory.value)
  const priorityValue = normalizeFilter(filterPriority.value)
  const complexityValue = normalizeFilter(filterComplexity.value)

  return scopedItems.value.filter(item => {
    if (categoryValue && item.category !== categoryValue) return false
    if (priorityValue && (item.priority ?? 'MEDIUM') !== priorityValue) return false
    if (complexityValue) {
      if (complexityValue === 'NONE') {
        if (item.complexity) return false
      } else if (item.complexity !== complexityValue) {
        return false
      }
    }
    if (query) {
      const title = item.title?.toLowerCase() ?? ''
      const description = item.description?.toLowerCase() ?? ''
      if (!title.includes(query) && !description.includes(query)) return false
    }
    return true
  })
})

// Listen for global task-open requests (e.g. from toast notifications)
onOpenTask(async (taskId: string, _projectId: string) => {
  try {
    const item = await $fetch(`/api/items/${taskId}`)
    if (item) {
      selectedItem.value = item
      showDetailModal.value = true
    }
  } catch { /* task not found or not accessible */ }
})

// Handle item creation
const handleCreateItem = async (data: { title: string; description?: string; category?: string; dueDate?: string; ownerId?: string | null; assigneeIds?: string[]; priority?: string; status?: string; agentMode?: 'PLAN' | 'EXECUTE' | null }) => {
  await createItem(data)
  showCreateModal.value = false
}

const handleAiCreatedItem = async (item: any) => {
  selectedItem.value = item
  showDetailModal.value = true
  showCreateModal.value = false
  await refreshItems()
}

// Handle drill down (for nested items)
const handleDrillDown = (item: any) => {
  attentionPaneOpen.value = false
  router.push(`/workspace/projects/${item.id}`)
}

// Handle opening item detail
const handleOpenDetail = (item: any) => {
  selectedItem.value = item
  showDetailModal.value = true
  attentionPaneOpen.value = false
}

const handleRequestComplete = (item: any) => {
  pendingCompleteItem.value = item
  showCompleteWithChildren.value = true
  completeWithChildrenError.value = null
}

const handleCompleteWithChildren = async () => {
  if (!pendingCompleteItem.value?.id) return
  completeWithChildrenLoading.value = true
  completeWithChildrenError.value = null
  try {
    await $fetch(`/api/items/${pendingCompleteItem.value.id}/complete`, {
      method: 'POST',
      body: { cascade: true, maxDepth: 5 },
    })
    showCompleteWithChildren.value = false
    pendingCompleteItem.value = null
    await refreshItems()
  } catch (e: any) {
    completeWithChildrenError.value = e?.data?.message || e?.message || 'Unable to complete subtasks.'
  } finally {
    completeWithChildrenLoading.value = false
  }
}

const handleSuggestedSelect = (item: any) => {
  showSuggestedWorkOrder.value = false
  handleOpenDetail(item)
}

const handleOpenAttention = (item: any, mode: 'at-risk' | 'blocked') => {
  attentionPaneRoot.value = item
  attentionPaneMode.value = mode
  attentionPaneOpen.value = true
}

const handleOpenDocs = (item: any) => {
  docsItem.value = item
  showDocsModal.value = true
}

// Handle item update from modal
const handleUpdateItem = async (_id: string, data: any) => {
  await refreshItems()
  if (data?._close) {
    showDetailModal.value = false
  }
}

// Handle view full board from modal
const handleViewFull = (item: any) => {
  router.push(`/workspace/projects/${item.id}`)
}

// Handle status change from drag and drop
const handleStatusChange = async (itemId: string, newStatus: string, newSubStatus?: string | null) => {
  const updatePayload: { status: string; subStatus?: string | null } = { status: newStatus }
  if (newSubStatus !== undefined) {
    updatePayload.subStatus = newSubStatus
  }
  await updateItem(itemId, updatePayload)
}

// Handle parent change from drag-and-drop nesting
const handleParentChange = async (itemId: string, newParentId: string) => {
  await updateItem(itemId, { parentId: newParentId })
}

// Handle breadcrumb navigation
const handleBreadcrumbClick = (crumbId: string) => {
  if (crumbId === 'root') {
    router.push('/workspace')
  } else {
    router.push(`/workspace/projects/${crumbId}`)
  }
}

// Keyboard navigation
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp') {
      e.preventDefault()
      if (currentScope.value?.parentId) {
        router.push(`/workspace/projects/${currentScope.value.parentId}`)
      } else {
        router.push('/workspace')
      }
      return
    }

    // View switching shortcuts (plain letter, no modifiers)
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return

    const match = viewOptions.value.find(v => v.shortcut.toLowerCase() === e.key.toLowerCase())
    if (match) {
      activeView.value = match.key as typeof activeView.value
      viewSwitchPulse.value = false
      void nextTick(() => { viewSwitchPulse.value = true })
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})
</script>

<template>
  <!-- Header -->
  <header class="relative z-30 px-6 py-5 flex flex-col gap-4">
    <!-- Breadcrumbs -->
    <nav class="flex items-center gap-1.5 text-sm">
      <button
        v-for="(crumb, i) in breadcrumbs"
        :key="crumb.id"
        class="flex items-center gap-1.5"
        @click="handleBreadcrumbClick(crumb.id)"
      >
        <Icon
          :name="i === 0 ? 'heroicons:home' : i === 1 ? 'heroicons:folder' : 'heroicons:clipboard-document-list'"
          :class="[
            'w-3.5 h-3.5 transition-colors',
            i === breadcrumbs.length - 1
              ? (i === 0 ? 'text-slate-500' : i === 1 ? 'text-blue-500' : 'text-emerald-500')
              : 'text-slate-300 dark:text-zinc-600'
          ]"
        />
        <span
          :class="[
            'hover:text-slate-900 dark:hover:text-zinc-100 transition-colors',
            i === breadcrumbs.length - 1 ? 'text-slate-800 dark:text-zinc-200 font-medium' : 'text-slate-400 dark:text-zinc-500'
          ]"
        >
          {{ crumb.title }}
        </span>
        <Icon
          v-if="i < breadcrumbs.length - 1"
          name="heroicons:chevron-right"
          class="w-3 h-3 text-slate-300 dark:text-zinc-600"
        />
      </button>
    </nav>

    <!-- Title row -->
    <div class="flex items-start justify-between gap-6">
      <div class="flex items-start gap-4 flex-1 min-w-0">
        <div class="flex-1 min-w-0 max-w-3xl">
          <!-- Title: display or edit -->
          <h1
            v-if="!editingTitle"
            class="text-xl font-medium text-slate-900 dark:text-zinc-100 cursor-text hover:bg-slate-50 dark:hover:bg-white/[0.06] rounded px-1 -mx-1 transition-colors"
            @click="editingTitle = true; nextTick(() => titleInputRef?.focus())"
          >
            {{ editedProjectTitle || 'Untitled project' }}
          </h1>
          <input
            v-else
            ref="titleInputRef"
            v-model="editedProjectTitle"
            type="text"
            class="text-xl font-medium text-slate-900 dark:text-zinc-100 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-slate-300 dark:placeholder-zinc-600 p-0 px-1 -mx-1 w-full"
            placeholder="Project title..."
            @blur="editingTitle = false"
            @keydown.enter="editingTitle = false"
          />

          <!-- Description: hidden from header (was inline edit) -->
        </div>
      </div>

      <div class="flex items-center gap-3">
        <!-- Settings button -->
        <button
          @click="selectedItem = currentScope; showDetailModal = true"
          class="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          title="Edit project details"
        >
          <Icon name="heroicons:cog-6-tooth" class="w-4 h-4 block" />
        </button>

        <!-- Document count indicator -->
        <button
          v-if="currentScope?.documentCount && currentScope.documentCount > 0"
          @click="activeView = 'documents'"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors text-sm"
          title="View documents"
        >
          <Icon name="heroicons:document-text" class="w-4 h-4 block" />
          <span class="font-medium">{{ currentScope.documentCount }}</span>
        </button>

        <!-- Team avatars -->
        <div v-if="currentScope?.assignees?.length" class="flex -space-x-2">
          <div
            v-for="assignee in currentScope.assignees.slice(0, 3)"
            :key="assignee.id"
            class="w-8 h-8 rounded-full border-2 border-white dark:border-dm bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center cursor-default"
            @mouseenter="onHeaderAssigneeEnter(assignee, $event)"
            @mouseleave="onHeaderAssigneeLeave"
          >
            <span class="text-xs text-white font-medium">{{ assignee.name?.[0] ?? 'U' }}</span>
          </div>
          <div
            v-if="currentScope.assignees.length > 3"
            class="w-8 h-8 rounded-full border-2 border-white dark:border-dm bg-slate-200 dark:bg-white/[0.08] flex items-center justify-center"
          >
            <span class="text-xs text-slate-600 dark:text-zinc-400 font-medium">+{{ currentScope.assignees.length - 3 }}</span>
          </div>
        </div>

        <!-- New item button -->
        <button
          v-if="canCreate && activeView !== 'documents' && activeView !== 'external' && activeView !== 'inbound'"
          @click="showCreateModal = true"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-white/[0.08] text-white dark:text-zinc-200 text-sm font-normal rounded-lg hover:bg-slate-800 dark:hover:bg-white/[0.12] transition-colors"
        >
          <Icon name="heroicons:plus" class="w-4 h-4" />
          <span>New</span>
        </button>

        <button
          v-else-if="activeView === 'documents'"
          @click="createDocumentFromHeader"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-white/[0.08] text-white dark:text-zinc-200 text-sm font-normal rounded-lg hover:bg-slate-800 dark:hover:bg-white/[0.12] transition-colors"
        >
          <Icon name="heroicons:document-text" class="w-4 h-4" />
          <span>New document</span>
        </button>

        <!-- View selector (expands down on hover) -->
        <div class="group relative">
          <!-- Active view trigger -->
          <button
            :class="[
              'flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-white/[0.1] transition-all',
              viewSwitchPulse && 'view-switch-pulse'
            ]"
            @animationend="viewSwitchPulse = false"
          >
            <Icon :name="activeViewOption.icon" class="w-4 h-4 block" />
            <span class="text-sm font-medium">{{ activeViewOption.label }}</span>
            <Icon name="heroicons:chevron-down" class="w-3 h-3 text-slate-400 transition-transform group-hover:rotate-180" />
          </button>

          <!-- Dropdown options -->
          <div class="absolute top-full right-0 mt-1 py-1 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.06] rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 min-w-[140px] z-50">
            <button
              v-for="option in viewOptions"
              :key="option.key"
              @click="activeView = option.key as typeof activeView"
              :class="[
                'flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors',
                option.key === activeView
                  ? 'bg-slate-50 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
                  : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-zinc-200'
              ]"
            >
              <Icon :name="option.icon" class="w-4 h-4 block" />
              <span class="text-sm">{{ option.label }}</span>
              <kbd class="ml-auto text-[10px] text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded font-mono">{{ option.shortcut }}</kbd>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div v-if="activeView !== 'documents' && activeView !== 'external' && activeView !== 'inbound'" class="flex items-center gap-2">
      <!-- Category -->
      <div class="group/category relative">
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card cursor-pointer transition-all duration-150 group-hover/category:border-slate-300 dark:group-hover/category:border-white/[0.1] group-hover/category:shadow-sm">
          <div
            class="w-1.5 h-1.5 rounded-full"
            :class="filterCategory ? (categoryDotColors[filterCategory] || 'bg-slate-400') : 'bg-slate-300'"
          />
          <span class="text-xs font-normal text-slate-600 dark:text-zinc-400">{{ filterCategory || 'Category' }}</span>
          <Icon name="heroicons:chevron-down" class="w-3 h-3 text-slate-400 transition-transform duration-150 group-hover/category:rotate-180" />
        </div>
        <div class="absolute top-full left-0 mt-1 bg-white dark:bg-dm-card rounded-lg border border-slate-200 dark:border-white/[0.06] shadow-lg overflow-hidden z-30 min-w-[160px] max-h-56 overflow-y-auto opacity-0 invisible translate-y-[-4px] transition-all duration-150 group-hover/category:opacity-100 group-hover/category:visible group-hover/category:translate-y-0">
          <div class="py-1">
            <button
              @click="filterCategory = null"
              class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
              :class="!filterCategory
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
            >
              <div class="w-2 h-2 rounded-full bg-slate-300" />
              <span>All categories</span>
            </button>
            <div class="border-t border-slate-100 dark:border-white/[0.06] my-1" />
            <button
              v-for="cat in categories"
              :key="cat"
              @click="filterCategory = cat"
              class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
              :class="filterCategory === cat
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
            >
              <div class="w-2 h-2 rounded-full" :class="categoryDotColors[cat] || 'bg-slate-400'" />
              <span>{{ cat }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Priority -->
      <div class="group/priority relative">
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card cursor-pointer transition-all duration-150 group-hover/priority:border-slate-300 dark:group-hover/priority:border-white/[0.1] group-hover/priority:shadow-sm">
          <div
            class="w-1.5 h-1.5 rounded-full"
            :class="filterPriority ? (priorityDotColors[filterPriority] || 'bg-slate-400') : 'bg-slate-300'"
          />
          <span class="text-xs font-normal text-slate-600 dark:text-zinc-400">{{ priorityLabel }}</span>
          <Icon name="heroicons:chevron-down" class="w-3 h-3 text-slate-400 transition-transform duration-150 group-hover/priority:rotate-180" />
        </div>
        <div class="absolute top-full left-0 mt-1 bg-white dark:bg-dm-card rounded-lg border border-slate-200 dark:border-white/[0.06] shadow-lg overflow-hidden z-30 min-w-[160px] max-h-56 overflow-y-auto opacity-0 invisible translate-y-[-4px] transition-all duration-150 group-hover/priority:opacity-100 group-hover/priority:visible group-hover/priority:translate-y-0">
          <div class="py-1">
            <button
              @click="filterPriority = null"
              class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
              :class="!filterPriority
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
            >
              <div class="w-2 h-2 rounded-full bg-slate-300" />
              <span>All priorities</span>
            </button>
            <div class="border-t border-slate-100 dark:border-white/[0.06] my-1" />
            <button
              v-for="opt in PRIORITY_OPTIONS"
              :key="opt.value"
              @click="filterPriority = opt.value"
              class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
              :class="filterPriority === opt.value
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
            >
              <div class="w-2 h-2 rounded-full" :class="priorityDotColors[opt.value] || 'bg-slate-400'" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Complexity -->
      <div class="group/complexity relative">
        <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card cursor-pointer transition-all duration-150 group-hover/complexity:border-slate-300 dark:group-hover/complexity:border-white/[0.1] group-hover/complexity:shadow-sm">
          <div
            class="w-1.5 h-1.5 rounded-full"
            :class="filterComplexity && filterComplexity !== 'NONE' ? (complexityDotColors[filterComplexity] || 'bg-slate-400') : 'bg-slate-300'"
          />
          <span class="text-xs font-normal text-slate-600 dark:text-zinc-400">{{ complexityLabel }}</span>
          <Icon name="heroicons:chevron-down" class="w-3 h-3 text-slate-400 transition-transform duration-150 group-hover/complexity:rotate-180" />
        </div>
        <div class="absolute top-full left-0 mt-1 bg-white dark:bg-dm-card rounded-lg border border-slate-200 dark:border-white/[0.06] shadow-lg overflow-hidden z-30 min-w-[160px] max-h-56 overflow-y-auto opacity-0 invisible translate-y-[-4px] transition-all duration-150 group-hover/complexity:opacity-100 group-hover/complexity:visible group-hover/complexity:translate-y-0">
          <div class="py-1">
            <button
              @click="filterComplexity = null"
              class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
              :class="!filterComplexity
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
            >
              <div class="w-2 h-2 rounded-full bg-slate-300" />
              <span>All complexity</span>
            </button>
            <button
              @click="filterComplexity = 'NONE'"
              class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
              :class="filterComplexity === 'NONE'
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
            >
              <div class="w-2 h-2 rounded-full bg-slate-300" />
              <span>No complexity</span>
            </button>
            <div class="border-t border-slate-100 dark:border-white/[0.06] my-1" />
            <button
              v-for="opt in COMPLEXITY_OPTIONS"
              :key="opt.value"
              @click="filterComplexity = opt.value"
              class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
              :class="filterComplexity === opt.value
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
            >
              <div class="w-2 h-2 rounded-full" :class="complexityDotColors[opt.value] || 'bg-slate-400'" />
              <span>{{ opt.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="flex-1" />

      <!-- Search + Suggested order -->
      <div class="flex items-center gap-2">
        <div class="relative">
          <Icon name="heroicons:magnifying-glass" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search..."
            class="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.06] rounded-full focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-zinc-600 focus:border-slate-300 dark:focus:border-zinc-600 dark:text-zinc-200 dark:placeholder-zinc-500 w-48 transition-all"
          />
        </div>
        <button
          @click="showSuggestedWorkOrder = true"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 dark:bg-white/[0.08] text-white dark:text-zinc-200 text-xs font-normal rounded-full hover:bg-slate-800 dark:hover:bg-white/[0.12] transition-colors"
        >
          <Icon name="heroicons:sparkles" class="w-3.5 h-3.5" />
          Suggested order
        </button>
      </div>
    </div>
  </header>

  <!-- Content -->
  <div class="flex-1 overflow-auto px-6 pb-6">
    <!-- Documents View -->
    <DocumentsSection
      v-if="activeView === 'documents'"
      ref="documentsSectionRef"
      :item-id="currentScope?.id ?? null"
      title="Documents"
      :show-helper="false"
      :new-button-label="'New document'"
      :empty-message="'No documents yet.'"
    />

    <!-- Kanban View -->
    <ViewsKanbanView
      v-if="activeView === 'kanban'"
      :items="filteredItems"
      :parent-item-id="currentScopeId ?? undefined"
      @drill-down="handleDrillDown"
      @open-detail="handleOpenDetail"
      @status-change="handleStatusChange"
      @parent-change="handleParentChange"
      @open-attention="handleOpenAttention"
      @request-complete="handleRequestComplete"
      @open-docs="handleOpenDocs"
      @open-archive="showArchiveModal = true"
    />

    <!-- Timeline View -->
    <ViewsTimelineView
      v-else-if="activeView === 'timeline'"
      :items="filteredItems"
      :is-root-level="false"
      @open-item="handleDrillDown"
      @open-detail="handleOpenDetail"
    />

    <!-- List View -->
    <ViewsListView
      v-else-if="activeView === 'list'"
      :items="filteredItems"
      :is-root-level="false"
      @openDetail="handleOpenDetail"
      @openItem="handleDrillDown"
    />

    <!-- External Spaces View -->
    <ExternalSpacesList
      v-else-if="activeView === 'external' && currentScope?.id"
      :project-id="currentScope.id"
    />

    <!-- Inbound Queue View -->
    <ExternalInboundQueue
      v-else-if="activeView === 'inbound' && currentScope?.id"
      ref="inboundQueueRef"
      :project-id="currentScope.id"
      @task-created="refreshItems"
    />
  </div>

  <!-- Create Item Modal -->
  <ItemsCreateItemModal
    :open="showCreateModal"
    :parent-title="currentScope?.title"
    :is-project="false"
    :workspace-id="workspaceId"
    :parent-id="currentScopeId"
    @close="showCreateModal = false"
    @create="handleCreateItem"
    @ai-created="handleAiCreatedItem"
  />

  <!-- Item Detail Modal -->
  <ItemsItemDetailModal
    :open="showDetailModal"
    :item="selectedItem"
    @close="showDetailModal = false"
    @update="handleUpdateItem"
    @view-full="handleViewFull"
    @deleted="showDetailModal = false; refreshItems()"
  />

  <ItemsItemAttentionPane
    :open="attentionPaneOpen"
    :mode="attentionPaneMode"
    :root-item="attentionPaneRoot"
    @close="attentionPaneOpen = false"
    @open-detail="handleOpenDetail"
    @drill-down="handleDrillDown"
  />

  <ItemsCompleteWithChildrenModal
    :open="showCompleteWithChildren"
    :title="pendingCompleteItem?.title"
    :max-depth="5"
    :loading="completeWithChildrenLoading"
    :error="completeWithChildrenError"
    @cancel="showCompleteWithChildren = false"
    @confirm="handleCompleteWithChildren"
  />

  <!-- Suggested Work Order Panel -->
  <ItemsSuggestedWorkOrderPanel
    :open="showSuggestedWorkOrder"
    :items="scopedItems"
    @close="showSuggestedWorkOrder = false"
    @select="handleSuggestedSelect"
  />

  <!-- Documents Modal (for task card doc counts) -->
  <DocumentsProjectDocumentsModal
    :open="showDocsModal"
    :project="docsItem"
    @close="showDocsModal = false"
  />

  <!-- Completed Items Archive Modal -->
  <ItemsCompletedArchiveModal
    v-if="currentScopeId"
    :open="showArchiveModal"
    :parent-item-id="currentScopeId"
    @close="showArchiveModal = false"
    @open-detail="handleOpenDetail"
  />

  <!-- Header assignee tooltip -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="headerTooltipAssignee"
        class="fixed z-[100] pointer-events-none"
        :style="{ top: `${headerTooltipPos.top}px`, left: `${headerTooltipPos.left}px`, transform: 'translateX(-50%)' }"
      >
        <div class="flex justify-center -mb-px">
          <div class="w-2 h-2 bg-white dark:bg-zinc-800 border-t border-l border-slate-200/80 dark:border-zinc-700 rotate-45 translate-y-1" />
        </div>
        <div class="px-2.5 py-1.5 bg-white dark:bg-zinc-800 rounded-lg shadow-lg shadow-black/10 dark:shadow-black/50 border border-slate-200/80 dark:border-zinc-700 whitespace-nowrap">
          <span class="text-xs font-medium text-slate-700 dark:text-zinc-200">{{ headerTooltipAssignee.name }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.view-switch-pulse {
  animation: viewPulse 0.4s ease-out;
}
@keyframes viewPulse {
  0% { box-shadow: 0 0 0 0 rgba(100, 116, 139, 0.4); background-color: rgba(100, 116, 139, 0.08); }
  50% { box-shadow: 0 0 0 5px rgba(100, 116, 139, 0); background-color: rgba(100, 116, 139, 0.04); }
  100% { box-shadow: 0 0 0 0 rgba(100, 116, 139, 0); }
}
@media (prefers-color-scheme: dark) {
  @keyframes viewPulse {
    0% { box-shadow: 0 0 0 0 rgba(148, 163, 184, 0.3); background-color: rgba(255, 255, 255, 0.1); }
    50% { box-shadow: 0 0 0 5px rgba(148, 163, 184, 0); background-color: rgba(255, 255, 255, 0.05); }
    100% { box-shadow: 0 0 0 0 rgba(148, 163, 184, 0); }
  }
}
</style>
