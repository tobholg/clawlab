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
const showTemplateModal = ref(false)
const attentionPaneOpen = ref(false)
const attentionPaneMode = ref<'at-risk' | 'blocked'>('at-risk')
const attentionPaneRoot = ref<any>(null)
const showUpgradeModal = ref(false)
const upgradeMessage = ref('')

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
const handleCreateItem = async (data: { title: string; description?: string; category?: string; dueDate?: string; ownerId?: string | null; assigneeIds?: string[]; priority?: string }) => {
  try {
    await createItem(data)
    showCreateModal.value = false
    if (refreshSidebar) refreshSidebar()
  } catch (e: any) {
    if (e?.statusCode === 403 || e?.data?.statusCode === 403) {
      showCreateModal.value = false
      upgradeMessage.value = e?.data?.message || e?.message || 'Plan limit reached.'
      showUpgradeModal.value = true
    }
  }
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

// Handle template creation
const handleTemplateCreated = (project: { id: string; title: string } | { error: true; message: string }) => {
  if ('error' in project) {
    showTemplateModal.value = false
    upgradeMessage.value = project.message
    showUpgradeModal.value = true
    return
  }
  showTemplateModal.value = false
  refreshItems()
  if (refreshSidebar) refreshSidebar()
  router.push(`/workspace/projects/${project.id}`)
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
        <!-- From template button -->
        <button
          @click="showTemplateModal = true"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-normal rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          <Icon name="heroicons:document-duplicate" class="w-4 h-4" />
          <span>From Template</span>
        </button>

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
  <div class="flex-1 overflow-auto px-6 pb-6">
    <!-- Empty state onboarding -->
    <div v-if="!scopedItems.length" class="flex items-center justify-center py-16">
      <div class="w-full max-w-2xl text-center">
        <div class="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
          <Icon name="heroicons:rocket-launch" class="w-7 h-7 text-slate-400" />
        </div>
        <h2 class="text-lg font-medium text-slate-900 mb-2">Welcome to your workspace</h2>
        <p class="text-sm text-slate-500 mb-8 leading-relaxed">
          Get started by creating your first project from scratch or use a template to hit the ground running.
        </p>
        <div class="flex items-center justify-center gap-3">
          <button
            @click="showTemplateModal = true"
            class="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <Icon name="heroicons:document-duplicate" class="w-4 h-4" />
            Start from template
          </button>
          <button
            @click="showCreateModal = true"
            class="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Icon name="heroicons:plus" class="w-4 h-4" />
            Create project
          </button>
        </div>
        <div class="mt-10 grid grid-cols-3 gap-5 text-left w-full">
          <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
            <Icon name="heroicons:view-columns" class="w-5 h-5 text-blue-500 mb-2.5" />
            <h3 class="text-sm font-medium text-slate-700">Kanban boards</h3>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">Organize and move tasks visually across stages</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
            <Icon name="heroicons:users" class="w-5 h-5 text-violet-500 mb-2.5" />
            <h3 class="text-sm font-medium text-slate-700">Stakeholder spaces</h3>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">Keep external collaborators in the loop effortlessly</p>
          </div>
          <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/60">
            <Icon name="heroicons:bolt" class="w-5 h-5 text-emerald-500 mb-2.5" />
            <h3 class="text-sm font-medium text-slate-700">Focus tracking</h3>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">See where your team spends time across projects</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Projects Dashboard -->
    <ViewsProjectsView
      v-else-if="activeView === 'dashboard'"
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
    :workspace-id="workspaceId"
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

  <!-- Template Picker Modal -->
  <ItemsTemplatePickerModal
    :open="showTemplateModal"
    :workspace-id="workspaceId"
    @close="showTemplateModal = false"
    @created="handleTemplateCreated"
  />

  <ItemsItemAttentionPane
    :open="attentionPaneOpen"
    :mode="attentionPaneMode"
    :root-item="attentionPaneRoot"
    @close="attentionPaneOpen = false"
    @open-detail="handleOpenDetail"
    @drill-down="handleDrillDown"
  />

  <!-- Upgrade Modal -->
  <UpgradeModal
    :open="showUpgradeModal"
    :message="upgradeMessage"
    @close="showUpgradeModal = false"
  />
</template>
