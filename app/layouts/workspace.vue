<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const { workspaceId, currentScope, navigateTo } = useItems()
const { isWorkspaceAdmin, isOrgAdmin, currentRole } = useWorkspaces()

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

// Recent projects for sidebar (top 5 by last activity)
const recentProjects = computed(() => {
  if (!sidebarProjects.value?.length) return []

  return [...sidebarProjects.value]
    .filter((p: any) => p.status !== 'done')
    .sort((a: any, b: any) => {
      const aTime = new Date(a.lastActivityAt || a.updatedAt || a.createdAt).getTime()
      const bTime = new Date(b.lastActivityAt || b.updatedAt || b.createdAt).getTime()
      return bTime - aTime
    })
    .slice(0, 5)
})

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
  if (tier === 'PRO') return 'bg-blue-100 text-blue-600'
  if (tier === 'ENTERPRISE') return 'bg-violet-100 text-violet-600'
  return 'bg-slate-100 text-slate-500'
})
</script>

<template>
  <div class="flex h-screen bg-[#FAFAFA] font-sans text-slate-900 overflow-hidden">

    <!-- Sidebar -->
    <aside
      :class="[
        'border-r border-slate-200 bg-white flex flex-col pt-5 transition-all duration-300 ease-in-out flex-shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-60 2xl:w-72'
      ]"
    >
      <!-- Workspace Switcher + Toggle -->
      <div :class="['mb-4 flex items-center', sidebarCollapsed ? 'flex-col gap-3' : 'px-3 justify-between']">
        <template v-if="sidebarCollapsed">
          <NuxtLink to="/workspace" class="flex items-center justify-center w-full">
            <div class="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg class="w-4 h-4" viewBox="0 0 32 32" fill="none"><path d="M14 5Q9 5 9 10L9 13.5Q9 16 6 16Q9 16 9 18.5L9 22Q9 27 14 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 5Q23 5 23 10L23 13.5Q23 16 26 16Q23 16 23 18.5L23 22Q23 27 18 27" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </NuxtLink>
        </template>
        <WorkspaceSwitcher v-else class="flex-1 min-w-0" />
        <button
          @click="toggleSidebar"
          class="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors flex items-center justify-center"
        >
          <Icon :name="sidebarCollapsed ? 'heroicons:chevron-right' : 'heroicons:chevron-left'" class="w-4 h-4" />
        </button>
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
          class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
        >
          <Icon name="heroicons:magnifying-glass" class="w-4 h-4" />
          <span class="flex-1 text-left">Search</span>
          <kbd class="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
        </button>
      </div>

      <!-- Focus Section -->
      <FocusSidebar v-if="!sidebarCollapsed" :workspace-id="workspaceId" />

      <!-- Projects Section -->
      <div v-if="!sidebarCollapsed" class="px-3 mb-4">
        <button
          @click="handleProjectsClick"
          class="mb-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider hover:text-slate-700 transition-colors flex items-center gap-1"
        >
          Projects
          <Icon name="heroicons:squares-2x2" class="w-3 h-3" />
        </button>
        <div>
          <button
            v-for="project in recentProjects"
            :key="project.id"
            @click="handleProjectClick(project.id)"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
            :class="currentProjectId === project.id
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'"
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
          <button
            v-if="!recentProjects.length"
            @click="router.push('/workspace')"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200"
          >
            <Icon name="heroicons:plus" class="w-4 h-4" />
            <span>Create new project</span>
          </button>
        </div>
      </div>

      <!-- Channels Section -->
      <div v-if="!sidebarCollapsed" class="px-3 mb-4">
        <h3 class="mb-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
          Channels
        </h3>
        <div>
          <template v-for="channel in channelTree" :key="channel.id">
            <NuxtLink
              :to="`/workspace/channels/${channel.id}`"
              class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
              :class="currentChannelId === channel.id
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'"
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
            <div v-if="channel.children?.length" class="ml-6">
              <NuxtLink
                v-for="child in channel.children"
                :key="child.id"
                :to="`/workspace/channels/${child.id}`"
                class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
                :class="currentChannelId === child.id
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'"
              >
                <Icon
                  :name="child.visibility === 'private' ? 'heroicons:lock-closed' : 'heroicons:hashtag'"
                  class="w-3 h-3"
                />
                <span class="truncate">{{ child.displayName }}</span>
              </NuxtLink>
            </div>
          </template>
          <div v-if="!channelTree.length && !channelsLoading" class="px-3 py-2 text-xs text-slate-500 italic">
            No channels yet
          </div>
        </div>
      </div>

      <!-- Workspace links -->
      <div v-if="!sidebarCollapsed" class="px-3 mb-4">
        <h3 class="mb-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
          Workspace
        </h3>
        <div>
          <NuxtLink
            to="/workspace/activities"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
            :class="route.path === '/workspace/activities'
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <Icon name="heroicons:clock" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Activity</span>
            <Icon name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 flex-shrink-0" />
          </NuxtLink>
          <NuxtLink
            v-if="isWorkspaceAdmin"
            to="/workspace/team"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
            :class="isTeamFocus
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <Icon name="heroicons:users" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Team focus</span>
            <Icon name="heroicons:chevron-right" class="w-3 h-3 text-slate-400 flex-shrink-0" />
          </NuxtLink>
          <NuxtLink
            v-if="isWorkspaceAdmin"
            to="/workspace/settings"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
            :class="route.path === '/workspace/settings'
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <Icon name="heroicons:cog-6-tooth" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Settings</span>
          </NuxtLink>
          <NuxtLink
            v-if="isOrgAdmin"
            to="/org"
            class="w-full flex items-center gap-2.5 px-3 py-1 rounded-lg text-sm transition-all duration-200"
            :class="route.path === '/org'
              ? 'bg-slate-100 text-slate-900'
              : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'"
          >
            <div class="w-4 h-4 flex items-center justify-center flex-shrink-0">
              <Icon name="heroicons:building-office-2" class="w-4 h-4" />
            </div>
            <span class="flex-1 text-left">Organization</span>
            <span
              v-if="planData"
              :class="['text-[10px] font-medium px-1.5 py-0.5 rounded-full', planTierClass]"
            >
              {{ planTierLabel }}
            </span>
          </NuxtLink>
        </div>
      </div>

      </div><!-- end scrollable content -->

      <!-- User -->
      <div class="px-3 pb-3">
        <button
          @click="showUserSettings = true"
          :class="[
            'w-full flex items-center rounded-lg hover:bg-slate-50 cursor-pointer transition-all duration-200',
            sidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
          ]"
        >
          <div class="w-7 h-7 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0">
            <span class="text-xs font-medium text-white">{{ userInitial }}</span>
          </div>
          <div :class="['flex-1 min-w-0 transition-all duration-300 overflow-hidden', sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100']">
            <div class="text-sm font-normal text-slate-800 truncate text-left">{{ userName }}</div>
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
    <main class="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
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

