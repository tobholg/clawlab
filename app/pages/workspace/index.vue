<script setup lang="ts">
definePageMeta({
  layout: false,
  // middleware: ['auth']  // TODO: re-enable
})

const route = useRoute()
const router = useRouter()

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
} = useItems()

// Handle project query param (when navigating from other pages)
// Wait for workspace to be loaded first
watch([() => route.query.project, workspaceId], async ([projectId, wsId]) => {
  if (projectId && typeof projectId === 'string' && wsId) {
    navigateTo(projectId)
    // Force refresh items for the new scope
    await refreshItems()
    // Clear the query param
    router.replace({ query: {} })
  }
}, { immediate: true })

// Fetch channels for sidebar
const { channelTree, loading: channelsLoading } = useChannels(workspaceId)

const activeView = ref<'dashboard' | 'kanban' | 'timeline' | 'list'>('dashboard')
const filterCategory = ref<string | null>(null)
const showCreateModal = ref(false)
const sidebarCollapsed = ref(false)
const showDetailModal = ref(false)
const selectedItem = ref<any>(null)

// Check if at root level (projects view)
const isRootLevel = computed(() => !currentScope.value || currentScope.value.id === 'root')

// Fetch all projects for sidebar (independent of current scope)
const { data: allProjects } = useFetch('/api/items', {
  query: computed(() => ({ workspaceId: workspaceId.value, parentId: 'root' })),
  watch: [workspaceId],
  default: () => []
})

// Recent projects for sidebar (top 5 by last activity)
const recentProjects = computed(() => {
  if (!allProjects.value || !Array.isArray(allProjects.value)) return []
  
  return [...allProjects.value]
    .sort((a: any, b: any) => {
      const aTime = new Date(a.lastActivityAt || a.updatedAt || a.createdAt).getTime()
      const bTime = new Date(b.lastActivityAt || b.updatedAt || b.createdAt).getTime()
      return bTime - aTime
    })
    .slice(0, 5)
})

// Reset view when navigating between levels
watch(isRootLevel, (isRoot) => {
  // Keep timeline if that's what user selected, otherwise default appropriately
  if (activeView.value !== 'timeline') {
    activeView.value = isRoot ? 'dashboard' : 'kanban'
  }
})

// Toggle sidebar
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// Handle item creation
const handleCreateItem = async (data: { title: string; description?: string; category?: string; dueDate?: string }) => {
  await createItem(data)
  showCreateModal.value = false
}

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

// Handle drill down
const handleDrillDown = (item: any) => {
  navigateTo(item.id)
}

// Handle opening item detail
const handleOpenDetail = (item: any) => {
  selectedItem.value = item
  showDetailModal.value = true
}

// Handle item update from modal (modal already saved, just refresh list)
const handleUpdateItem = async (_id: string, data: any) => {
  // Modal already saved the data, just refresh the items list
  await refreshItems(true) // Force refresh after update
  // Only close if explicitly requested (not on auto-save)
  if (data?._close) {
    showDetailModal.value = false
  }
}

// Handle view full board from modal
const handleViewFull = (item: any) => {
  navigateTo(item.id)
}

// Handle status change from drag and drop (with optional subStatus)
const handleStatusChange = async (itemId: string, newStatus: string, newSubStatus?: string | null) => {
  // Only include subStatus in update if explicitly provided (not undefined)
  // This preserves existing subStatus when moving to/from done
  const updatePayload: { status: string; subStatus?: string | null } = { status: newStatus }
  if (newSubStatus !== undefined) {
    updatePayload.subStatus = newSubStatus
  }
  await updateItem(itemId, updatePayload)
}

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
    await refreshItems(true) // Force refresh after save
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

// Keyboard navigation
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowUp') {
      e.preventDefault()
      navigateUp()
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})
</script>

<template>
  <div class="flex h-screen bg-[#FAFAFA] font-sans text-slate-900 overflow-hidden">
    
    <!-- Sidebar -->
    <aside 
      :class="[
        'border-r border-slate-100 bg-white flex flex-col py-5 transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-16' : 'w-56'
      ]"
    >
      <!-- Logo + Toggle -->
      <div :class="['mb-4 flex items-center', sidebarCollapsed ? 'flex-col gap-3' : 'px-5 justify-between']">
        <div :class="['flex items-center gap-2.5', sidebarCollapsed ? 'justify-center w-full' : '']">
          <div class="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <span class="text-white text-sm font-medium">R</span>
          </div>
          <span 
            :class="[
              'text-base font-medium tracking-tight transition-all duration-300 overflow-hidden whitespace-nowrap',
              sidebarCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'
            ]"
          >
            Relai
          </span>
        </div>
        <button 
          @click="toggleSidebar"
          class="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center"
        >
          <Icon :name="sidebarCollapsed ? 'heroicons:chevron-right' : 'heroicons:chevron-left'" class="w-4 h-4" />
        </button>
      </div>

      <!-- Focus Section -->
      <FocusSidebar v-if="!sidebarCollapsed" :workspace-id="workspaceId" />
      
      <!-- Team Section -->
      <TeamPresence v-if="!sidebarCollapsed" :workspace-id="workspaceId" />

      <!-- Projects Section -->
      <div v-if="!sidebarCollapsed" class="px-3 mb-4">
        <button 
          @click="navigateTo('root'); activeView = 'dashboard'"
          class="mb-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors flex items-center gap-1"
        >
          Projects
          <Icon name="heroicons:squares-2x2" class="w-3 h-3" />
        </button>
        <div class="space-y-1">
          <button
            v-for="project in recentProjects.slice(0, 5)"
            :key="project.id"
            @click="navigateTo(project.id)"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-200"
            :class="currentScope?.id === project.id
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <div 
                class="w-2 h-2 rounded-full" 
                :class="project.status === 'done' ? 'bg-emerald-400' : project.status === 'in_progress' ? 'bg-blue-400' : 'bg-slate-300'" 
              />
            </div>
            <span class="flex-1 text-left truncate">{{ project.title }}</span>
            <Icon name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 flex-shrink-0" />
          </button>
          <div v-if="!recentProjects.length" class="px-3 py-2 text-[10px] text-slate-400 italic">
            No projects yet
          </div>
        </div>
      </div>

      <!-- Channels Section -->
      <div v-if="!sidebarCollapsed" class="px-3 mb-4">
        <h3 class="mb-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          Channels
        </h3>
        <div class="space-y-1">
          <template v-for="channel in channelTree" :key="channel.id">
            <NuxtLink 
              :to="`/workspace/channels/${channel.id}`"
              class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            >
              <div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
                <Icon 
                  :name="channel.visibility === 'private' ? 'heroicons:lock-closed' : 'heroicons:hashtag'" 
                  class="w-4 h-4" 
                />
              </div>
              <span class="flex-1 text-left truncate">{{ channel.displayName }}</span>
              <span 
                v-if="channel.unreadCount && channel.unreadCount > 0"
                class="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full"
              >
                {{ channel.unreadCount }}
              </span>
              <Icon v-else name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 flex-shrink-0" />
            </NuxtLink>
            
            <!-- Nested channels -->
            <div v-if="channel.children?.length" class="ml-6 space-y-1">
              <NuxtLink 
                v-for="child in channel.children"
                :key="child.id"
                :to="`/workspace/channels/${child.id}`"
                class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              >
                <Icon 
                  :name="child.visibility === 'private' ? 'heroicons:lock-closed' : 'heroicons:hashtag'" 
                  class="w-3 h-3" 
                />
                <span class="truncate">{{ child.displayName }}</span>
              </NuxtLink>
            </div>
          </template>
          <div v-if="!channelTree.length && !channelsLoading" class="px-3 py-2 text-[10px] text-slate-400 italic">
            No channels yet
          </div>
        </div>
      </div>

      <!-- Settings Section -->
      <div v-if="!sidebarCollapsed" class="px-3 mb-4">
        <h3 class="mb-2 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          Settings
        </h3>
        <div class="space-y-1">
          <button class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-50">
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <Icon name="heroicons:cog-6-tooth" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Workspace settings</span>
            <Icon name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 flex-shrink-0" />
          </button>
        </div>
      </div>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- User -->
      <div class="px-3 mb-4">
        <div 
          :class="[
            'flex items-center rounded-lg hover:bg-slate-50 cursor-pointer transition-all duration-200',
            sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
          ]"
        >
          <div class="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
            <span class="text-xs font-medium text-slate-600">T</span>
          </div>
          <div :class="['flex-1 min-w-0 transition-all duration-300 overflow-hidden', sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100']">
            <div class="text-sm font-normal text-slate-800 truncate">Tobias</div>
          </div>
          <Icon 
            v-if="!sidebarCollapsed"
            name="heroicons:chevron-up-down" 
            class="w-4 h-4 text-slate-400 flex-shrink-0" 
          />
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 relative overflow-hidden">
      <!-- Header -->
      <header class="relative z-10 px-6 py-5 flex flex-col gap-4">
        <!-- Breadcrumbs -->
        <nav class="flex items-center gap-1.5 text-sm">
          <button 
            v-for="(crumb, i) in breadcrumbs" 
            :key="crumb.id"
            class="flex items-center gap-1.5"
            @click="navigateTo(crumb.id)"
          >
            <!-- Icon based on level: root=home, project=folder, task=clipboard -->
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
            <!-- Scope icon (color coded: project=blue, task=green) -->
            <div 
              v-if="!isRootLevel" 
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
              <!-- Editable title when inside project, static when at root -->
              <input
                v-if="!isRootLevel"
                v-model="editedProjectTitle"
                type="text"
                class="text-xl font-medium text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-slate-300 p-0 w-full"
                placeholder="Project title..."
              />
              <h1 v-else class="text-xl font-medium text-slate-900">Projects</h1>
              
              <!-- Editable description when inside project (textarea for newlines) -->
              <textarea
                v-if="!isRootLevel"
                v-model="editedProjectDescription"
                rows="1"
                class="text-sm text-slate-400 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-slate-400 p-0 mt-1 w-full resize-none overflow-hidden"
                placeholder="Add a description..."
                @input="(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }"
                @focus="(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }"
              />
              <p v-else class="text-sm text-slate-400 mt-0.5">
                {{ scopedItems.length }} projects in workspace
              </p>
            </div>
          </div>
          
          <div class="flex items-center gap-4">
            <!-- Progress bar (only when inside a project) -->
            <div v-if="!isRootLevel && currentScope?.progress !== undefined" class="flex items-center gap-3">
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
            
            <!-- Team avatars (only when inside a project) -->
            <div v-if="!isRootLevel && currentScope?.assignees?.length" class="flex -space-x-2">
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
            
            <!-- Settings button (only when inside a project) -->
            <button 
              v-if="!isRootLevel"
              @click="selectedItem = currentScope; showDetailModal = true"
              class="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Edit project details"
            >
              <Icon name="heroicons:cog-6-tooth" class="w-4 h-4 block" />
            </button>
          
            <!-- View toggle -->
            <div class="flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
              <!-- Dashboard (root only) -->
              <button 
                v-if="isRootLevel"
                @click="activeView = 'dashboard'"
                :class="[
                  'flex items-center justify-center w-7 h-7 rounded transition-all',
                  activeView === 'dashboard' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'
                ]"
                title="Dashboard"
              >
                <Icon name="heroicons:squares-2x2" class="w-4 h-4 block" />
              </button>
              <!-- Kanban (inside project only) -->
              <button 
                v-if="!isRootLevel"
                @click="activeView = 'kanban'"
                :class="[
                  'flex items-center justify-center w-7 h-7 rounded transition-all',
                  activeView === 'kanban' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600'
                ]"
                title="Kanban"
              >
                <Icon name="heroicons:view-columns" class="w-4 h-4 block" />
              </button>
              <!-- Timeline (all levels) -->
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
              <!-- List (all levels) -->
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
            
            <!-- New item/project button -->
            <button 
              @click="showCreateModal = true"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm font-normal rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Icon name="heroicons:plus" class="w-4 h-4" />
              <span>{{ isRootLevel ? 'New Project' : 'New' }}</span>
            </button>
          </div>
        </div>
        
        <!-- Filters (only inside projects) -->
        <div v-if="!isRootLevel" class="flex items-center gap-2">
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
        <!-- Projects Dashboard (root level, dashboard view) -->
        <ViewsProjectsView 
          v-if="isRootLevel && activeView === 'dashboard'"
          :projects="filteredItems"
          @open-project="handleDrillDown"
          @open-detail="handleOpenDetail"
          @create-project="showCreateModal = true"
        />
        
        <!-- Timeline View (all levels) -->
        <ViewsTimelineView
          v-else-if="activeView === 'timeline'"
          :items="filteredItems"
          :is-root-level="isRootLevel"
          @open-item="handleDrillDown"
          @open-detail="handleOpenDetail"
        />
        
        <!-- Kanban View (inside project) -->
        <ViewsKanbanView 
          v-else-if="!isRootLevel && activeView === 'kanban'"
          :items="filteredItems"
          @drill-down="handleDrillDown"
          @open-detail="handleOpenDetail"
          @status-change="handleStatusChange"
        />
        
        <!-- List View (all levels) -->
        <ViewsListView
          v-else-if="activeView === 'list'"
          :items="filteredItems"
          :is-root-level="isRootLevel"
          @openDetail="handleOpenDetail"
          @openItem="handleDrillDown"
        />
      </div>
    </main>
    
    <!-- Create Item Modal -->
    <ItemsCreateItemModal
      :open="showCreateModal"
      :parent-title="currentScope?.title"
      :is-project="isRootLevel"
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
  </div>
</template>
