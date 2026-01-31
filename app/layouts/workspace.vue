<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const { workspaceId, currentScope, navigateTo } = useItems()

// Fetch channels for sidebar
const { channelTree, loading: channelsLoading } = useChannels(workspaceId)

const sidebarCollapsed = ref(false)

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

// Fetch on mount and when workspaceId changes
onMounted(fetchProjects)
watch(workspaceId, fetchProjects)

// Recent projects for sidebar (top 5 by last activity)
const recentProjects = computed(() => {
  if (!sidebarProjects.value?.length) return []

  return [...sidebarProjects.value]
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

// Provide refresh function to child pages
provide('refreshSidebarProjects', fetchProjects)
</script>

<template>
  <div class="flex h-screen bg-[#FAFAFA] font-sans text-slate-900 overflow-hidden">

    <!-- Sidebar -->
    <aside
      :class="[
        'border-r border-slate-200 bg-white flex flex-col pt-5 transition-all duration-300 ease-in-out flex-shrink-0',
        sidebarCollapsed ? 'w-16' : 'w-60'
      ]"
    >
      <!-- Logo + Toggle -->
      <div :class="['mb-4 flex items-center', sidebarCollapsed ? 'flex-col gap-3' : 'px-3 justify-between']">
        <NuxtLink to="/workspace" :class="['flex items-center gap-2.5', sidebarCollapsed ? 'justify-center w-full' : '']">
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
        </NuxtLink>
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
            class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200"
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
          <div v-if="!recentProjects.length" class="px-3 py-2 text-xs text-slate-500 italic">
            No projects yet
          </div>
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
              class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200"
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
                class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200"
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

      <!-- Settings Section -->
      <div v-if="!sidebarCollapsed" class="px-3 mb-4">
        <h3 class="mb-2 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
          Settings
        </h3>
        <div>
          <button class="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100">
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
      <div class="px-3 pb-3">
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
      <slot />
    </main>

    <!-- Quick Chat -->
    <QuickChatOrb />
    <QuickChatBubble />
  </div>
</template>
