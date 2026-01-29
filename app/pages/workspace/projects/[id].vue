<script setup lang="ts">
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

// Navigate to this project when route changes or on mount
// navigateTo handles the case where we're already at this scope
watch(projectId, (id) => {
  if (id) {
    navigateTo(id)
  }
}, { immediate: true })

const activeView = ref<'kanban' | 'timeline' | 'list'>('kanban')
const filterCategory = ref<string | null>(null)
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const selectedItem = ref<any>(null)

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
const categories = computed(() => {
  const cats = new Set(scopedItems.value.map(i => i.category).filter(Boolean))
  return Array.from(cats)
})

// Filter items
const filteredItems = computed(() => {
  if (!filterCategory.value) return scopedItems.value
  return scopedItems.value.filter(i => i.category === filterCategory.value)
})

// Handle item creation
const handleCreateItem = async (data: { title: string; description?: string; category?: string; dueDate?: string }) => {
  await createItem(data)
  showCreateModal.value = false
}

// Handle drill down (for nested items)
const handleDrillDown = (item: any) => {
  router.push(`/workspace/projects/${item.id}`)
}

// Handle opening item detail
const handleOpenDetail = (item: any) => {
  selectedItem.value = item
  showDetailModal.value = true
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
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})
</script>

<template>
  <!-- Header -->
  <header class="relative z-10 px-6 py-5 flex flex-col gap-4">
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
              : 'text-slate-300'
          ]"
        />
        <span
          :class="[
            'hover:text-slate-900 transition-colors',
            i === breadcrumbs.length - 1 ? 'text-slate-800 font-medium' : 'text-slate-400'
          ]"
        >
          {{ crumb.title }}
        </span>
        <Icon
          v-if="i < breadcrumbs.length - 1"
          name="heroicons:chevron-right"
          class="w-3 h-3 text-slate-300"
        />
      </button>
    </nav>

    <!-- Title row -->
    <div class="flex items-start justify-between gap-6">
      <div class="flex items-start gap-4 flex-1 min-w-0">
        <!-- Scope icon -->
        <div
          class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          :class="breadcrumbs.length <= 2
            ? 'bg-gradient-to-br from-blue-50 to-blue-100'
            : 'bg-gradient-to-br from-emerald-50 to-emerald-100'"
        >
          <Icon
            :name="breadcrumbs.length <= 2 ? 'heroicons:folder' : 'heroicons:clipboard-document-list'"
            :class="breadcrumbs.length <= 2 ? 'w-5 h-5 text-blue-500' : 'w-5 h-5 text-emerald-500'"
          />
        </div>

        <div class="flex-1 min-w-0 max-w-3xl">
          <!-- Editable title -->
          <input
            v-model="editedProjectTitle"
            type="text"
            class="text-xl font-medium text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-slate-300 p-0 w-full"
            placeholder="Project title..."
          />

          <!-- Editable description -->
          <textarea
            v-model="editedProjectDescription"
            rows="1"
            class="text-sm text-slate-400 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-slate-400 p-0 mt-1 w-full resize-none overflow-hidden"
            placeholder="Add a description..."
            @input="(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }"
            @focus="(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }"
          />
        </div>
      </div>

      <div class="flex items-center gap-4">
        <!-- Progress bar -->
        <div v-if="currentScope?.progress !== undefined" class="flex items-center gap-3">
          <div class="w-32">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="text-slate-400">Progress</span>
              <span class="font-medium text-slate-600">{{ currentScope.progress }}%</span>
            </div>
            <div class="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all duration-300"
                :style="{ width: `${currentScope.progress}%` }"
              />
            </div>
          </div>
        </div>

        <!-- Team avatars -->
        <div v-if="currentScope?.assignees?.length" class="flex -space-x-2">
          <div
            v-for="assignee in currentScope.assignees.slice(0, 3)"
            :key="assignee.id"
            class="w-8 h-8 rounded-full border-2 border-white bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center"
            :title="assignee.name"
          >
            <span class="text-xs text-white font-medium">{{ assignee.name?.[0] ?? 'U' }}</span>
          </div>
          <div
            v-if="currentScope.assignees.length > 3"
            class="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center"
          >
            <span class="text-xs text-slate-600 font-medium">+{{ currentScope.assignees.length - 3 }}</span>
          </div>
        </div>

        <!-- Settings button -->
        <button
          @click="selectedItem = currentScope; showDetailModal = true"
          class="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Edit project details"
        >
          <Icon name="heroicons:cog-6-tooth" class="w-4 h-4 block" />
        </button>

        <!-- View toggle -->
        <div class="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
          <button
            @click="activeView = 'kanban'"
            :class="[
              'flex items-center justify-center w-7 h-7 rounded transition-all',
              activeView === 'kanban' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'
            ]"
            title="Kanban"
          >
            <Icon name="heroicons:view-columns" class="w-4 h-4 block" />
          </button>
          <button
            @click="activeView = 'timeline'"
            :class="[
              'flex items-center justify-center w-7 h-7 rounded transition-all',
              activeView === 'timeline' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'
            ]"
            title="Timeline"
          >
            <Icon name="heroicons:calendar" class="w-4 h-4 block" />
          </button>
          <button
            @click="activeView = 'list'"
            :class="[
              'flex items-center justify-center w-7 h-7 rounded transition-all',
              activeView === 'list' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'
            ]"
            title="List"
          >
            <Icon name="heroicons:bars-3" class="w-4 h-4 block" />
          </button>
        </div>

        <!-- New item button -->
        <button
          @click="showCreateModal = true"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm font-normal rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Icon name="heroicons:plus" class="w-4 h-4" />
          <span>New</span>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-2">
      <button
        @click="filterCategory = null"
        :class="[
          'px-2.5 py-1 rounded-full text-xs font-normal border transition-all',
          filterCategory === null
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
        ]"
      >
        All
      </button>
      <button
        v-for="cat in categories"
        :key="cat"
        @click="filterCategory = filterCategory === cat ? null : cat"
        :class="[
          'px-2.5 py-1 rounded-full text-xs font-normal border transition-all',
          filterCategory === cat
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
        ]"
      >
        {{ cat }}
      </button>

      <div class="h-4 w-px bg-slate-200 mx-1" />

      <!-- Search -->
      <div class="relative">
        <Icon name="heroicons:magnifying-glass" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search..."
          class="pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-1 focus:ring-slate-300 focus:border-slate-300 w-40 transition-all"
        />
      </div>
    </div>
  </header>

  <!-- Content -->
  <div class="flex-1 overflow-auto px-6 pb-8">
    <!-- Kanban View -->
    <ViewsKanbanView
      v-if="activeView === 'kanban'"
      :items="filteredItems"
      @drill-down="handleDrillDown"
      @open-detail="handleOpenDetail"
      @status-change="handleStatusChange"
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
  </div>

  <!-- Create Item Modal -->
  <ItemsCreateItemModal
    :open="showCreateModal"
    :parent-title="currentScope?.title"
    :is-project="false"
    @close="showCreateModal = false"
    @create="handleCreateItem"
  />

  <!-- Item Detail Modal -->
  <ItemsItemDetailModal
    :open="showDetailModal"
    :item="selectedItem"
    @close="showDetailModal = false"
    @update="handleUpdateItem"
    @view-full="handleViewFull"
  />
</template>
