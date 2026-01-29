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
</script>

<template>
  <!-- Header -->
  <header class="relative z-10 px-6 py-5 flex flex-col gap-4">
    <!-- Title row -->
    <div class="flex items-start justify-between gap-6">
      <div class="flex items-start gap-4 flex-1 min-w-0">
        <div class="flex-1 min-w-0 max-w-3xl">
          <h1 class="text-xl font-medium text-slate-900">{{ currentScope?.title || 'Projects' }}</h1>
          <p class="text-sm text-slate-400 mt-0.5">
            {{ scopedItems.length }} projects
          </p>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <!-- View toggle -->
        <div class="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
          <button
            @click="activeView = 'dashboard'"
            :class="[
              'flex items-center justify-center w-7 h-7 rounded transition-all',
              activeView === 'dashboard' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'
            ]"
            title="Dashboard"
          >
            <Icon name="heroicons:squares-2x2" class="w-4 h-4 block" />
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

        <!-- New project button -->
        <button
          @click="showCreateModal = true"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm font-normal rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Icon name="heroicons:plus" class="w-4 h-4" />
          <span>New Project</span>
        </button>
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
  />
</template>
