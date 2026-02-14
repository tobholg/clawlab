<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const { workspaceId, currentScope, navigateTo } = useItems()
const { isWorkspaceAdmin, isOrgAdmin, currentRole } = useWorkspaces()
const { toggleSection, isSectionCollapsed } = useSidebarSections()
const { sidebarPreview, activeCount: myTasksActiveCount, hasMoreTasks, fetchMyTasks } = useMyTasks()

// Fetch channels for sidebar
const { channelTree, loading: channelsLoading } = useChannels(workspaceId)

const sidebarCollapsed = ref(false)
const showUserSettings = ref(false)

const { user } = useAuth()
const userInitial = computed(() => (user.value?.name || user.value?.email || '?').charAt(0).toUpperCase())
const userName = computed(() => user.value?.name || user.value?.email || 'User')

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
        'border-r border-slate-200/60 dark:border-white/[0.06] bg-white dark:bg-[#010101] flex flex-col pt-5 transition-all duration-300 ease-in-out flex-shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-60 2xl:w-72'
      ]"
    >
      <!-- Workspace Switcher -->
      <div :class="['mb-4', sidebarCollapsed ? 'flex justify-center' : 'px-3']">
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
      <div v-if="!sidebarCollapsed" class="px-3 mb-3">
        <button
          @click="openSearch"
          class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-white/[0.06] transition-all duration-200"
        >
          <Icon name="heroicons:magnifying-glass" class="w-4 h-4" />
          <span class="flex-1 text-left">Search</span>
          <kbd class="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/[0.06] dark:text-zinc-500 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      </div>

      <!-- Focus Section -->
      <div v-if="!sidebarCollapsed" :class="isSectionCollapsed('focus') ? 'mb-1' : ''">
        <div :class="['flex items-center justify-between px-3', isSectionCollapsed('focus') ? '' : 'mb-2']">
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
      <div v-if="!sidebarCollapsed" :class="['px-3', isSectionCollapsed('projects') ? 'mb-1' : 'mb-4']">
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
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
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
            <Icon name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 dark:text-zinc-600 flex-shrink-0" />
          </button>
          <button
            v-if="!recentProjects.length"
            @click="router.push('/workspace')"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm text-slate-500 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-200"
          >
            <Icon name="heroicons:plus" class="w-4 h-4" />
            <span>Create new project</span>
          </button>
          <NuxtLink
            v-if="hasMoreProjects"
            to="/workspace"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-200"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:arrow-right" class="w-3 h-3" />
            </div>
            <span class="flex-1 text-left">View all {{ allActiveProjects.length }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- My Tasks Section -->
      <div v-if="!sidebarCollapsed" :class="['px-3', isSectionCollapsed('myTasks') ? 'mb-1' : 'mb-4']">
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
              class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200 text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            >
              <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
                <div class="w-2 h-2 rounded-full" :class="statusDotClass(task.status)" />
              </div>
              <span class="flex-1 text-left truncate">{{ task.title }}</span>
              <Icon name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 dark:text-zinc-600 flex-shrink-0" />
            </button>
            <NuxtLink
              v-if="hasMoreTasks"
              to="/workspace/my-work"
              class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all duration-200"
            >
              <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
                <Icon name="heroicons:arrow-right" class="w-3 h-3" />
              </div>
              <span class="flex-1 text-left">View all {{ myTasksActiveCount }}</span>
            </NuxtLink>
          </template>
          <p v-else class="px-3 py-2 text-xs text-slate-400 dark:text-zinc-600 italic">No active tasks</p>
        </div>
      </div>

      <!-- Channels Section -->
      <div v-if="!sidebarCollapsed" :class="['px-3', isSectionCollapsed('channels') ? 'mb-1' : 'mb-4']">
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
          <template v-for="channel in channelTree" :key="channel.id">
            <NuxtLink
              :to="`/workspace/channels/${channel.id}`"
              class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
              :class="currentChannelId === channel.id
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
                : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
            >
              <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
                <Icon
                  :name="channel.visibility === 'private' ? 'heroicons:lock-closed' : channel.type === 'project' ? 'heroicons:folder' : 'heroicons:hashtag'"
                  class="w-4 h-4"
                />
              </div>
              <span class="flex-1 text-left truncate">{{ channel.displayName }}</span>
              <span
                v-if="channel.unreadCount && channel.unreadCount > 0"
                class="text-[10px] bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400 px-1.5 py-0.5 rounded-full"
              >
                {{ channel.unreadCount }}
              </span>
              <Icon v-else name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 dark:text-zinc-600 flex-shrink-0" />
            </NuxtLink>

            <!-- Nested channels -->
            <div v-if="channel.children?.length" class="ml-6">
              <NuxtLink
                v-for="child in channel.children"
                :key="child.id"
                :to="`/workspace/channels/${child.id}`"
                class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
                :class="currentChannelId === child.id
                  ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
                  : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
              >
                <Icon
                  :name="child.visibility === 'private' ? 'heroicons:lock-closed' : child.type === 'project' ? 'heroicons:folder' : 'heroicons:hashtag'"
                  class="w-3 h-3"
                />
                <span class="truncate">{{ child.displayName }}</span>
              </NuxtLink>
            </div>
          </template>
          <div v-if="!channelTree.length && !channelsLoading" class="px-3 py-2 text-xs text-slate-500 dark:text-zinc-600 italic">
            No channels yet
          </div>
        </div>
      </div>

      <!-- Workspace links -->
      <div v-if="!sidebarCollapsed" :class="['px-3', isSectionCollapsed('workspace') ? 'mb-1' : 'mb-4']">
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
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
            :class="isMyWork
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:clipboard-document-check" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">My Work</span>
            <Icon name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 dark:text-zinc-600 flex-shrink-0" />
          </NuxtLink>
          <NuxtLink
            to="/workspace/activities"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
            :class="route.path === '/workspace/activities'
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:clock" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Activity</span>
            <Icon name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 dark:text-zinc-600 flex-shrink-0" />
          </NuxtLink>
          <NuxtLink
            v-if="isWorkspaceAdmin"
            to="/workspace/team"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
            :class="isTeamFocus
              ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100'
              : 'text-slate-600 dark:text-zinc-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0 dark:text-zinc-500">
              <Icon name="heroicons:users" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Team focus</span>
            <Icon name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 dark:text-zinc-600 flex-shrink-0" />
          </NuxtLink>
          <NuxtLink
            v-if="isWorkspaceAdmin"
            to="/workspace/settings"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
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
            v-if="isOrgAdmin"
            to="/org"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
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
      <div class="px-3 mb-1">
        <button
          @click="toggleSidebar"
          :class="[
            'w-full flex items-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] transition-all duration-200',
            sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-1'
          ]"
        >
          <Icon :name="sidebarCollapsed ? 'heroicons:chevron-right' : 'heroicons:chevron-left'" class="w-4 h-4 flex-shrink-0" />
          <span v-if="!sidebarCollapsed" class="text-sm">Collapse</span>
        </button>
      </div>

      <!-- User -->
      <div class="px-3 pb-3">
        <button
          @click="showUserSettings = true"
          :class="[
            'w-full flex items-center rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] cursor-pointer transition-all duration-200',
            sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
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
    <main class="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-dm-surface dark:to-dm-surface">
      <Transition name="content-fade">
        <div :key="route.path" class="absolute inset-0 flex flex-col overflow-auto">
          <slot />
        </div>
      </Transition>
    </main>

    <!-- Quick Chat -->
    <QuickChatOrb />
    <QuickChatBubble />

    <!-- Command Palette (Cmd+K) -->
    <CommandPalette />

    <!-- User Settings Modal -->
    <UserSettingsModal
      v-if="showUserSettings"
      @close="showUserSettings = false"
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
