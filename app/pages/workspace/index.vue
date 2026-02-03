<script setup lang="ts">
definePageMeta({
  layout: 'workspace',
})

const route = useRoute()
const router = useRouter()

const {
  scopedItems,
  createItem,
  refreshItems,
  workspaceId,
  navigateTo,
  currentScope,
} = useItems()

// Always show root level on this page
// navigateTo handles both clearing stale data and triggering a refresh
watch(() => route.path, (path) => {
  if (path === '/workspace') {
    navigateTo('root')
  }
}, { immediate: true })

const activeView = ref<'dashboard' | 'timeline' | 'list'>('dashboard')
const showCreateModal = ref(false)
const showDetailModal = ref(false)
const selectedItem = ref<any>(null)
const attentionPaneOpen = ref(false)
const attentionPaneMode = ref<'at-risk' | 'blocked'>('at-risk')
const attentionPaneRoot = ref<any>(null)

// View options configuration
const viewOptions = [
  { key: 'dashboard', icon: 'heroicons:squares-2x2', label: 'Dashboard' },
  { key: 'timeline', icon: 'heroicons:calendar', label: 'Timeline' },
  { key: 'list', icon: 'heroicons:bars-3', label: 'List' },
]

const activeViewOption = computed(() => {
  return viewOptions.find(v => v.key === activeView.value) || viewOptions[0]
})

// Get sidebar refresh function from layout (must be called at top level)
const refreshSidebar = inject<() => Promise<void>>('refreshSidebarProjects')

// Handle item creation
const handleCreateItem = async (data: { title: string; description?: string; category?: string; dueDate?: string }) => {
  await createItem(data)
  showCreateModal.value = false
  // Refresh sidebar projects
  if (refreshSidebar) refreshSidebar()
}

// Handle drill down to project
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

const handleOpenAttention = (item: any, mode: 'at-risk' | 'blocked') => {
  attentionPaneRoot.value = item
  attentionPaneMode.value = mode
  attentionPaneOpen.value = true
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
</script>

<template>
  <!-- Header -->
  <header class="relative z-10 px-6 py-5 flex flex-col gap-4">
    <!-- Title row -->
    <div class="flex items-start justify-between gap-6">
      <div class="flex items-start gap-4 flex-1 min-w-0">
        <div class="flex-1 min-w-0 max-w-3xl">
          <h1 class="text-xl font-medium text-slate-900">{{ currentScope?.title || 'Projects' }}</h1>
          <p class="text-sm text-slate-500 mt-0.5">
            {{ scopedItems.length }} projects
          </p>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <!-- New project button -->
        <button
          @click="showCreateModal = true"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm font-normal rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Icon name="heroicons:plus" class="w-4 h-4" />
          <span>New Project</span>
        </button>

        <!-- View selector (expands down on hover) -->
        <div class="group relative">
          <!-- Active view trigger -->
          <button
            class="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 hover:border-slate-300 transition-all"
          >
            <Icon :name="activeViewOption.icon" class="w-4 h-4 block" />
            <span class="text-sm font-medium">{{ activeViewOption.label }}</span>
            <Icon name="heroicons:chevron-down" class="w-3 h-3 text-slate-400 transition-transform group-hover:rotate-180" />
          </button>

          <!-- Dropdown options -->
          <div class="absolute top-full right-0 mt-1 py-1 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 min-w-[140px] z-50">
            <button
              v-for="option in viewOptions"
              :key="option.key"
              @click="activeView = option.key as typeof activeView"
              :class="[
                'flex items-center gap-2.5 w-full px-3 py-2 text-left transition-colors',
                option.key === activeView
                  ? 'bg-slate-50 text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              ]"
            >
              <Icon :name="option.icon" class="w-4 h-4 block" />
              <span class="text-sm">{{ option.label }}</span>
              <Icon
                v-if="option.key === activeView"
                name="heroicons:check"
                class="w-4 h-4 ml-auto text-slate-500"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Content -->
  <div class="flex-1 overflow-auto px-6 pb-8">
    <!-- Projects Dashboard -->
    <ViewsProjectsView
      v-if="activeView === 'dashboard'"
      :projects="scopedItems"
      @open-project="handleDrillDown"
      @open-detail="handleOpenDetail"
      @create-project="showCreateModal = true"
      @open-attention="handleOpenAttention"
    />

    <!-- Timeline View -->
    <ViewsTimelineView
      v-else-if="activeView === 'timeline'"
      :items="scopedItems"
      :is-root-level="true"
      @open-item="handleDrillDown"
      @open-detail="handleOpenDetail"
    />

    <!-- List View -->
    <ViewsListView
      v-else-if="activeView === 'list'"
      :items="scopedItems"
      :is-root-level="true"
      @openDetail="handleOpenDetail"
      @openItem="handleDrillDown"
    />
  </div>

  <!-- Create Item Modal -->
  <ItemsCreateItemModal
    :open="showCreateModal"
    :parent-title="null"
    :is-project="true"
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
    @deleted="showDetailModal = false; refreshItems(); refreshSidebar?.()"
  />

  <ItemsItemAttentionPane
    :open="attentionPaneOpen"
    :mode="attentionPaneMode"
    :root-item="attentionPaneRoot"
    @close="attentionPaneOpen = false"
    @open-detail="handleOpenDetail"
    @drill-down="handleDrillDown"
  />
</template>
