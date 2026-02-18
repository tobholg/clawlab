<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const { workspaceId, currentScope, navigateTo } = useItems()
const { isWorkspaceAdmin, isOrgAdmin, currentRole } = useWorkspaces()
const { toggleSection, isSectionCollapsed } = useSidebarSections()
const { sidebarPreview, activeCount: myTasksActiveCount, hasMoreTasks, fetchMyTasks } = useMyTasks()

// Fetch channels for sidebar
const { channels: allChannels, channelTree, loading: channelsLoading, fetchChannels: refreshChannels } = useChannels(workspaceId)
provide('refreshSidebarChannels', refreshChannels)

const sidebarCollapsed = ref(false)
const showUserSettings = ref(false)
const showCreateChannel = ref(false)
const collapsedChannels = ref<Set<string>>(new Set())
const collapsedChannelsInitialized = ref(false)
const projectChannelsCollapsed = ref(true)

// Split channel tree into regular channels and project channels
const regularChannels = computed(() => channelTree.value.filter((c: any) => c.type !== 'project'))
const projectChannels = computed(() => channelTree.value.filter((c: any) => c.type === 'project'))

// Collapse all nested channels by default on first load
watch(channelTree, (tree) => {
  if (collapsedChannelsInitialized.value || !tree?.length) return
  collapsedChannelsInitialized.value = true
  const ids = new Set<string>()
  for (const ch of tree) {
    if (ch.children?.length) ids.add(ch.id)
  }
  if (ids.size) collapsedChannels.value = ids
}, { immediate: true })

const toggleChannelChildren = (channelId: string) => {
  const next = new Set(collapsedChannels.value)
  if (next.has(channelId)) {
    next.delete(channelId)
  } else {
    next.add(channelId)
  }
  collapsedChannels.value = next
}

const { user } = useAuth()
const {
  authenticate: authenticateSocket,
  subscribeWorkspace,
  unsubscribeWorkspace,
} = useWebSocket()
const userInitial = computed(() => (user.value?.name || user.value?.email || '?').charAt(0).toUpperCase())
const userName = computed(() => user.value?.name || user.value?.email || 'User')
const activeWorkspaceSocketSubscription = ref<string | null>(null)

watch(user, (nextUser) => {
  if (!nextUser) return
  authenticateSocket({
    id: nextUser.id,
    name: nextUser.name || nextUser.email || 'Anonymous',
    avatar: nextUser.avatar,
  })
}, { immediate: true })

watch(workspaceId, (nextWorkspaceId, previousWorkspaceId) => {
  if (previousWorkspaceId && previousWorkspaceId !== nextWorkspaceId) {
    unsubscribeWorkspace(previousWorkspaceId)
    if (activeWorkspaceSocketSubscription.value === previousWorkspaceId) {
      activeWorkspaceSocketSubscription.value = null
    }
  }

  if (nextWorkspaceId && activeWorkspaceSocketSubscription.value !== nextWorkspaceId) {
    subscribeWorkspace(nextWorkspaceId)
    activeWorkspaceSocketSubscription.value = nextWorkspaceId
  }
}, { immediate: true })

onUnmounted(() => {
  if (activeWorkspaceSocketSubscription.value) {
    unsubscribeWorkspace(activeWorkspaceSocketSubscription.value)
    activeWorkspaceSocketSubscription.value = null
  }
})

// Fetch all projects for sidebar
const sidebarProjects = ref<any[]>([])
const projectsLoading = ref(false)

const fetchProjects = async () => {
  if (!workspaceId.value || projectsLoading.value) return

  projectsLoading.value = true
  try {
    const data = await $fetch('/api/items', {
      query: { workspaceId: workspaceId.value, parentId: 'root' }
    })
    if (Array.isArray(data)) {
      sidebarProjects.value = data
    }
  } catch (e) {
    console.error('Failed to fetch projects:', e)
  } finally {
    projectsLoading.value = false
  }
}

// Fetch projects when workspaceId is available or changes
watch(workspaceId, (wsId) => {
  if (wsId) fetchProjects()
}, { immediate: true })
onMounted(() => {
  if (workspaceId.value) fetchProjects()

  // Global keyboard shortcut: P → navigate to projects
  const handleGlobalKeydown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return

    if (e.key.toLowerCase() === 'p' && route.path !== '/workspace') {
      router.push('/workspace')
    }
  }
  window.addEventListener('keydown', handleGlobalKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleGlobalKeydown))
})

// Recent projects for sidebar (top 3 by last activity)
const allActiveProjects = computed(() => {
  if (!sidebarProjects.value?.length) return []
  return [...sidebarProjects.value]
    .filter((p: any) => p.status !== 'done')
    .sort((a: any, b: any) => {
      const aTime = new Date(a.lastActivityAt || a.updatedAt || a.createdAt).getTime()
      const bTime = new Date(b.lastActivityAt || b.updatedAt || b.createdAt).getTime()
      return bTime - aTime
    })
})
const recentProjects = computed(() => allActiveProjects.value.slice(0, 3))
const hasMoreProjects = computed(() => allActiveProjects.value.length > 3)

// Current project ID from route
const currentProjectId = computed(() => {
  if (route.params.id && route.path.includes('/workspace/projects/')) {
    return route.params.id as string
  }
  return null
})

// Current channel ID from route
const currentChannelId = computed(() => {
  if (route.params.id && route.path.includes('/workspace/channels/')) {
    return route.params.id as string
  }
  return null
})

const isTeamFocus = computed(() => route.path === '/workspace/team')
const isMyWork = computed(() => route.path === '/workspace/my-work')
const isAgentsPage = computed(() => route.path === '/workspace/agents')

// Handle project click - navigate to project page
const handleProjectClick = (projectId: string) => {
  router.push(`/workspace/projects/${projectId}`)
}

// Handle projects header click - go to projects list
const handleProjectsClick = () => {
  router.push('/workspace')
}

// Toggle sidebar
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// Provide refresh function and role info to child pages
provide('refreshSidebarProjects', fetchProjects)
provide('currentRole', currentRole)
provide('isWorkspaceAdmin', isWorkspaceAdmin)
provide('isOrgAdmin', isOrgAdmin)

// Search palette trigger
const openSearch = () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))
}

// Plan tier
const { data: planData } = useFetch(() => workspaceId.value ? `/api/workspaces/${workspaceId.value}/usage` : null, {
  watch: [workspaceId],
})
const planTierLabel = computed(() => {
  const tier = (planData.value as any)?.planTier
  if (tier === 'PRO') return 'Pro'
  if (tier === 'ENTERPRISE') return 'Enterprise'
  return 'Free'
})
const planTierClass = computed(() => {
  const tier = (planData.value as any)?.planTier
  if (tier === 'PRO') return 'text-blue-500'
  if (tier === 'ENTERPRISE') return 'text-violet-500'
  return 'text-slate-400'
})

// FocusSidebar ref for timeline
const focusSidebarRef = ref<{ openTimeline: () => void } | null>(null)

// My Tasks - ItemDetailModal
const showTaskDetail = ref(false)
const selectedTask = ref<any>(null)

const handleSidebarTaskClick = (task: any) => {
  selectedTask.value = task
  showTaskDetail.value = true
}

const handleTaskUpdate = async (_id: string, opts?: { _close?: boolean }) => {
  if (opts?._close) {
    showTaskDetail.value = false
  }
  await fetchMyTasks()
}

// Status color helper
const statusDotClass = (status: string) => {
  switch (status) {
    case 'DONE': return 'bg-emerald-400'
    case 'IN_PROGRESS': return 'bg-blue-400'
    case 'BLOCKED': return 'bg-red-400'
    case 'PAUSED': return 'bg-amber-400'
    default: return 'bg-slate-300'
  }
}

</script>

<template>
  <div class="flex h-screen bg-[#FAFAFA] dark:bg-dm-surface font-sans text-slate-900 dark:text-zinc-100 overflow-hidden">

    <!-- Sidebar -->
    <aside
      :class="[
        'bg-white dark:bg-[#0e0e11] flex flex-col pt-5 transition-all duration-300 ease-in-out flex-shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-60 2xl:w-72'
      ]"
    >
      <!-- Workspace Switcher -->
      <div :class="['mb-4', sidebarCollapsed ? 'flex justify-center' : 'px-4']">
        <template v-if="sidebarCollapsed">
          <NuxtLink to="/workspace" class="flex items-center justify-center w-full">
            <div class="w-7 h-7 bg-slate-900 dark:bg-white/[0.1] rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </NuxtLink>
        </template>
        <WorkspaceSwitcher v-else class="w-full" />
      </div>

      <!-- Scrollable content -->
      <div
        class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        @click.self="toggleSidebar()"
      >

      <!-- Search button -->
      <div v-if="!sidebarCollapsed" class="px-4 mb-3">
        <button
          @click="openSearch"
          class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition-all duration-200"
        >
          <Icon name="heroicons:magnifying-glass" class="w-4 h-4" />
          <span class="flex-1 text-left">Search</span>
          <kbd class="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/[0.06] dark:text-zinc-500 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      </div>

      <!-- Focus Section -->
      <div v-if="!sidebarCollapsed" :class="isSectionCollapsed('focus') ? 'mb-1' : ''">
        <div :class="['flex items-center justify-between px-4', isSectionCollapsed('focus') ? '' : 'mb-2']">
          <button
            @click="focusSidebarRef?.openTimeline()"
            class="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            Focus
            <Icon name="heroicons:clock" class="w-3 h-3" />
          </button>
          <button
            @click="toggleSection('focus')"
            class="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            <Icon :name="isSectionCollapsed('focus') ? 'heroicons:chevron-right' : 'heroicons:chevron-down'" class="w-3 h-3" />
          </button>
        </div>
        <div v-if="!isSectionCollapsed('focus')">
          <FocusSidebar ref="focusSidebarRef" :workspace-id="workspaceId" />
        </div>
      </div>

      <!-- Projects Section -->
      <div v-if="!sidebarCollapsed" :class="['px-4', isSectionCollapsed('projects') ? 'mb-1' : 'mb-4']">
        <div :class="['flex items-center justify-between', isSectionCollapsed('projects') ? '' : 'mb-2']">
          <button
            @click="handleProjectsClick"
            class="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            Projects
            <Icon name="heroicons:squares-2x2" class="w-3 h-3" />
          </button>
          <button
            @click="toggleSection('projects')"
            class="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            <Icon :name="isSectionCollapsed('projects') ? 'heroicons:chevron-right' : 'heroicons:chevron-down'" class="w-3 h-3" />
          </button>
        </div>
        <div v-if="!isSectionCollapsed('projects')">
          <button
            v-for="project in recentProjects"
            :key="project.id"
            @click="handleProjectClick(project.id)"
            class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200"
            :class="currentProjectId === project.id
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <div
                class="w-2 h-2 rounded-full"
                :class="project.status === 'done' ? 'bg-emerald-400' : project.status === 'in_progress' ? 'bg-blue-400' : 'bg-slate-300'"
              />
            </div>
            <span class="flex-1 text-left truncate">{{ project.title }}</span>
          </button>
          <button
            v-if="!recentProjects.length"
            @click="router.push('/workspace')"
            class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm text-slate-500 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-200"
          >
            <Icon name="heroicons:plus" class="w-4 h-4" />
            <span>Create new project</span>
          </button>
          <NuxtLink
            v-if="hasMoreProjects"
            to="/workspace"
            class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-200"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:arrow-right" class="w-3 h-3" />
            </div>
            <span class="flex-1 text-left">View all {{ allActiveProjects.length }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- My Tasks Section -->
      <div v-if="!sidebarCollapsed" :class="['px-4', isSectionCollapsed('myTasks') ? 'mb-1' : 'mb-4']">
        <div :class="['flex items-center justify-between', isSectionCollapsed('myTasks') ? '' : 'mb-2']">
          <NuxtLink
            to="/workspace/my-work"
            class="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-white transition-colors flex items-center gap-1"
          >
            My Tasks
            <Icon name="heroicons:clipboard-document-check" class="w-3 h-3" />
          </NuxtLink>
          <button
            @click="toggleSection('myTasks')"
            class="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            <Icon :name="isSectionCollapsed('myTasks') ? 'heroicons:chevron-right' : 'heroicons:chevron-down'" class="w-3 h-3" />
          </button>
        </div>
        <div v-if="!isSectionCollapsed('myTasks')">
          <template v-if="sidebarPreview.length">
            <button
              v-for="task in sidebarPreview"
              :key="task.id"
              @click="handleSidebarTaskClick(task)"
              class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200 text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            >
              <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
                <div class="w-2 h-2 rounded-full" :class="statusDotClass(task.status)" />
              </div>
              <span class="flex-1 text-left truncate">{{ task.title }}</span>
            </button>
            <NuxtLink
              v-if="hasMoreTasks"
              to="/workspace/my-work"
              class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-200"
            >
              <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
                <Icon name="heroicons:arrow-right" class="w-3 h-3" />
              </div>
              <span class="flex-1 text-left">View all {{ myTasksActiveCount }}</span>
            </NuxtLink>
          </template>
          <p v-else class="px-2 py-2 text-xs text-slate-400 dark:text-zinc-600 italic">No active tasks</p>
        </div>
      </div>


      <!-- Channels Section -->
      <div v-if="!sidebarCollapsed" :class="['px-4', isSectionCollapsed('channels') ? 'mb-1' : 'mb-4']">
        <div :class="['flex items-center justify-between', isSectionCollapsed('channels') ? '' : 'mb-2']">
          <button @click="toggleSection('channels')" class="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            Channels
          </button>
          <button
            @click="toggleSection('channels')"
            class="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            <Icon :name="isSectionCollapsed('channels') ? 'heroicons:chevron-right' : 'heroicons:chevron-down'" class="w-3 h-3" />
          </button>
        </div>
        <div v-if="!isSectionCollapsed('channels')">
          <!-- New channel button -->
          <button
            @click="showCreateChannel = true"
            class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-200"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:plus" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">New Channel</span>
          </button>

          <!-- Regular (non-project) channels -->
          <template v-for="channel in regularChannels" :key="channel.id">
            <NuxtLink
              :to="`/workspace/channels/${channel.id}`"
              class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200"
              :class="currentChannelId === channel.id
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
                : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
            >
              <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
                <Icon
                  :name="channel.visibility === 'private' ? 'heroicons:lock-closed' : 'heroicons:hashtag'"
                  class="w-4 h-4"
                />
              </div>
              <span class="flex-1 text-left truncate">{{ channel.displayName }}</span>
              <span v-if="channel.hasUnread && currentChannelId !== channel.id" class="relative flex-shrink-0 w-2 h-2">
                <span class="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" />
                <span class="relative block w-2 h-2 rounded-full bg-emerald-400" />
              </span>
              <Icon
                v-else-if="channel.children?.length"
                :name="collapsedChannels.has(channel.id) ? 'heroicons:chevron-right' : 'heroicons:chevron-down'"
                class="w-3 h-3 text-slate-400 dark:text-zinc-400 flex-shrink-0 cursor-pointer hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                @click.prevent="toggleChannelChildren(channel.id)"
              />
            </NuxtLink>

            <!-- Nested channels -->
            <div v-if="channel.children?.length && !collapsedChannels.has(channel.id)" class="ml-6">
              <NuxtLink
                v-for="child in channel.children"
                :key="child.id"
                :to="`/workspace/channels/${child.id}`"
                class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200"
                :class="currentChannelId === child.id
                  ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
                  : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
              >
                <Icon
                  :name="child.visibility === 'private' ? 'heroicons:lock-closed' : 'heroicons:hashtag'"
                  class="w-3 h-3"
                />
                <span class="truncate">{{ child.displayName }}</span>
              </NuxtLink>
            </div>
          </template>

          <!-- Project channels group -->
          <div v-if="projectChannels.length">
            <button
              @click="projectChannelsCollapsed = !projectChannelsCollapsed"
              class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-200"
            >
              <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
                <Icon name="heroicons:folder" class="w-4 h-4" />
              </div>
              <span class="flex-1 text-left">Projects</span>
              <Icon
                :name="projectChannelsCollapsed ? 'heroicons:chevron-right' : 'heroicons:chevron-down'"
                class="w-3 h-3 text-slate-400 dark:text-zinc-400 flex-shrink-0"
              />
            </button>
            <div v-if="!projectChannelsCollapsed" class="ml-6">
              <template v-for="channel in projectChannels" :key="channel.id">
                <NuxtLink
                  :to="`/workspace/channels/${channel.id}`"
                  class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200"
                  :class="currentChannelId === channel.id
                    ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
                    : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
                >
                  <Icon name="heroicons:hashtag" class="w-3 h-3 flex-shrink-0" />
                  <span class="flex-1 text-left truncate">{{ channel.displayName }}</span>
                  <span v-if="channel.hasUnread && currentChannelId !== channel.id" class="relative flex-shrink-0 w-2 h-2">
                    <span class="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" />
                    <span class="relative block w-2 h-2 rounded-full bg-emerald-400" />
                  </span>
                </NuxtLink>
              </template>
            </div>
          </div>

          <div v-if="!channelTree.length && !channelsLoading" class="px-2 py-2 text-xs text-slate-500 dark:text-zinc-600 italic">
            No channels yet
          </div>
        </div>
      </div>

      <!-- Workspace links -->
      <div v-if="!sidebarCollapsed" :class="['px-4', isSectionCollapsed('workspace') ? 'mb-1' : 'mb-4']">
        <div :class="['flex items-center justify-between', isSectionCollapsed('workspace') ? '' : 'mb-2']">
          <button @click="toggleSection('workspace')" class="text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-white transition-colors">
            Workspace
          </button>
          <button
            @click="toggleSection('workspace')"
            class="p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            <Icon :name="isSectionCollapsed('workspace') ? 'heroicons:chevron-right' : 'heroicons:chevron-down'" class="w-3 h-3" />
          </button>
        </div>
        <div v-if="!isSectionCollapsed('workspace')">
          <NuxtLink
            to="/workspace/my-work"
            class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200"
            :class="isMyWork
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:clipboard-document-check" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">My Work</span>
          </NuxtLink>
          <NuxtLink
            to="/workspace/activities"
            class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200"
            :class="route.path === '/workspace/activities'
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:clock" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Activity</span>
          </NuxtLink>
          <NuxtLink
            v-if="isWorkspaceAdmin"
            to="/workspace/team"
            class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200"
            :class="isTeamFocus
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:users" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Team focus</span>
          </NuxtLink>
          <NuxtLink
            v-if="isWorkspaceAdmin"
            to="/workspace/settings"
            class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200"
            :class="route.path === '/workspace/settings'
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:cog-6-tooth" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Settings</span>
          </NuxtLink>
          <NuxtLink
            v-if="isWorkspaceAdmin"
            to="/workspace/agents"
            class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200"
            :class="isAgentsPage
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:cpu-chip" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Agents</span>
          </NuxtLink>
          <NuxtLink
            v-if="isOrgAdmin"
            to="/org"
            class="w-full flex items-center gap-2.5 px-2 py-1 rounded-lg text-sm transition-all duration-200"
            :class="route.path === '/org'
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:building-office-2" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Organization</span>
            <span
              v-if="planData"
              :class="['text-[10px] font-medium', planTierClass]"
            >
              {{ planTierLabel }}
            </span>
          </NuxtLink>
        </div>
      </div>

      </div><!-- end scrollable content -->

      <!-- Collapse/Expand Toggle -->
      <div class="px-4 mb-1">
        <button
          @click="toggleSidebar"
          :class="[
            'w-full flex items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] transition-all duration-200',
            sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-2 py-1'
          ]"
        >
          <Icon :name="sidebarCollapsed ? 'heroicons:chevron-right' : 'heroicons:chevron-left'" class="w-4 h-4 flex-shrink-0" />
          <span v-if="!sidebarCollapsed" class="text-sm">Collapse</span>
        </button>
      </div>

      <!-- User -->
      <div class="px-4 pb-3">
        <button
          @click="showUserSettings = true"
          :class="[
            'w-full flex items-center rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] cursor-pointer transition-all duration-200',
            sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-2 py-2'
          ]"
        >
          <div class="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0">
            <span class="text-xs font-medium text-white">{{ userInitial }}</span>
          </div>
          <div :class="['flex-1 min-w-0 transition-all duration-300 overflow-hidden', sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100']">
            <div class="text-sm font-normal text-slate-800 dark:text-zinc-200 truncate text-left">{{ userName }}</div>
          </div>
          <Icon
            v-if="!sidebarCollapsed"
            name="heroicons:chevron-up-down"
            class="w-4 h-4 text-slate-400 flex-shrink-0"
          />
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-slate-50 dark:bg-dm-surface">
      <Transition name="content-fade">
        <div :key="route.path" class="absolute inset-0 flex flex-col overflow-auto">
          <slot />
        </div>
      </Transition>
    </main>

    <!-- Quick Chat -->
    <QuickChatOrb />
    <QuickChatBubble />

    <!-- Agent Terminal Overlay -->
    <AgentTerminalOrb />
    <AgentTerminalOverlay />

    <!-- Command Palette (Cmd+K) -->
    <CommandPalette />

    <!-- Agent activity notifications -->
    <UiAgentActivityToast />

    <!-- User Settings Modal -->
    <UserSettingsModal
      v-if="showUserSettings"
      @close="showUserSettings = false"
    />

    <!-- Create Channel Modal -->
    <ChannelsCreateChannelModal
      :open="showCreateChannel"
      :workspace-id="workspaceId || ''"
      :channels="allChannels.filter(c => !c.parentId).map(c => ({ id: c.id, displayName: c.displayName }))"
      @close="showCreateChannel = false"
      @created="refreshChannels()"
    />

    <!-- Sidebar Task Detail Modal -->
    <ItemsItemDetailModal
      :open="showTaskDetail"
      :item="selectedTask"
      @close="showTaskDetail = false"
      @update="handleTaskUpdate"
      @view-full="(item: any) => { showTaskDetail = false; router.push(`/workspace/projects/${item.id}`) }"
      @deleted="handleTaskUpdate"
    />
  </div>
</template>

<style scoped>
.content-fade-enter-active {
  transition: opacity 200ms ease;
}
.content-fade-leave-active {
  transition: opacity 150ms ease;
  position: absolute;
  inset: 0;
}
.content-fade-enter-from,
.content-fade-leave-to {
  opacity: 0;
}
</style>
