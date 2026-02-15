<script setup lang="ts">
import StakeholderChat from '~/components/stakeholder/StakeholderChat.vue'

definePageMeta({
  layout: false
})

const route = useRoute()
const router = useRouter()
const { user, isAuthenticated, fetchUser, logout } = useAuth()

const spaceId = computed(() => route.params.spaceId as string)
const spaceSlug = computed(() => route.params.spaceSlug as string)

// Tab state
const activeTab = ref<'overview' | 'updates' | 'requests' | 'qa'>('overview')

// Chat state
const chatOpen = ref(false)

// Page load animation
const isPageLoaded = ref(false)

// Space data types
interface TaskNode {
  id: string
  title: string
  status: string
  subStatus?: string | null
  progress: number
  confidence?: number
  startDate?: string | null
  dueDate?: string | null
  childrenCount?: number
  completedChildrenCount?: number
  children?: TaskNode[]
}

interface ActivityDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  completions: Array<{ id: string; title: string }>
}

interface CompletedTaskNode {
  id: string
  title: string
  startDate: string | null
  completedAt: string | null
  durationDays: number | null
  childrenCount: number
  children: CompletedTaskNode[]
}

interface Stakeholder {
  id: string
  name: string | null
  email: string
  displayName: string | null
  position: string | null
  joinedAt: string
}

interface SpaceData {
  id: string
  name: string
  slug: string
  description?: string
  project: {
    id: string
    title: string
    description?: string
    progress?: number
    confidence?: number
    createdAt: string
  }
  stakeholders: Stakeholder[]
  stakeholderCount: number
  activeTasks: TaskNode[]
  completedTasks: CompletedTaskNode[]
  activityData?: ActivityDay[]
  stats?: {
    totalActive: number
    totalCompleted: number
    avgProgress: number
    avgConfidence: number
    weeksTracked: number
  }
  access: {
    canSubmitTasks: boolean
    isTeamMember?: boolean
    displayName?: string
    position?: string
  }
}

// Space data
const loading = ref(true)
const error = ref('')
const space = ref<SpaceData | null>(null)

// Stakeholders modal
const showStakeholdersModal = ref(false)

// Format relative date for "created X ago"
const formatRelativeDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return '1 week ago'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 60) return '1 month ago'
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) > 1 ? 's' : ''} ago`
}

interface ExternalComment {
  id: string
  authorName: string
  content: string
  isTeamMember: boolean
  createdAt: string
}

// My requests data
const myRequests = ref<{
  tasks: Array<{
    id: string
    title: string
    description: string
    status: string
    rejectionReason?: string
    linkedTaskId?: string
    comments: ExternalComment[]
    createdAt: string
  }>
  irs: Array<{
    id: string
    type: string
    content: string
    status: string
    response?: string
    comments: ExternalComment[]
    createdAt: string
  }>
} | null>(null)
const loadingRequests = ref(false)

// Reply state for tasks and IRs
const replyContent = ref<Record<string, string>>({})
const submittingReply = ref<Record<string, boolean>>({})

// Submit reply/comment to a task
const submitTaskComment = async (taskId: string) => {
  const content = replyContent.value[`task-${taskId}`]?.trim()
  if (!content) return
  
  submittingReply.value[`task-${taskId}`] = true
  
  try {
    await $fetch(`/api/s/${spaceId.value}/${spaceSlug.value}/tasks/${taskId}/comment`, {
      method: 'POST',
      body: { content }
    })
    
    replyContent.value[`task-${taskId}`] = ''
    await fetchMyRequests()
  } catch (e: any) {
    alert('Failed to send comment: ' + (e.data?.message || e.message))
  } finally {
    submittingReply.value[`task-${taskId}`] = false
  }
}

// Submit reply/comment to an IR
const submitIRComment = async (irId: string) => {
  const content = replyContent.value[`ir-${irId}`]?.trim()
  if (!content) return
  
  submittingReply.value[`ir-${irId}`] = true
  
  try {
    await $fetch(`/api/s/${spaceId.value}/${spaceSlug.value}/ir/${irId}/comment`, {
      method: 'POST',
      body: { content }
    })
    
    replyContent.value[`ir-${irId}`] = ''
    await fetchMyRequests()
  } catch (e: any) {
    alert('Failed to send comment: ' + (e.data?.message || e.message))
  } finally {
    submittingReply.value[`ir-${irId}`] = false
  }
}

// Q&A data
const qaItems = ref<Array<{
  id: string
  type: string
  content: string
  status: string
  response?: string
  votes: number
  hasVoted: boolean
  createdBy: {
    displayName?: string
    position?: string
  }
  comments: ExternalComment[]
  createdAt: string
}>>([])
const loadingQA = ref(false)
const qaSort = ref<'recent' | 'votes'>('recent')
const qaSearch = ref('')

// Submit comment on Q&A item
const submitQAComment = async (irId: string) => {
  const content = replyContent.value[`qa-${irId}`]?.trim()
  if (!content) return
  
  submittingReply.value[`qa-${irId}`] = true
  
  try {
    const result = await $fetch<{ comment: ExternalComment }>(`/api/s/${spaceId.value}/${spaceSlug.value}/ir/${irId}/comment`, {
      method: 'POST',
      body: { content }
    })
    
    const item = qaItems.value.find(i => i.id === irId)
    if (item) {
      item.comments.push(result.comment)
    }
    
    replyContent.value[`qa-${irId}`] = ''
  } catch (e: any) {
    alert('Failed to send comment: ' + (e.data?.message || e.message))
  } finally {
    submittingReply.value[`qa-${irId}`] = false
  }
}

// Updates data
const updates = ref<Array<{
  id: string
  title: string
  summary: string
  risks: Array<{ text: string }>
  wins: Array<{ text: string }>
  status: string
  publishedAt: string | null
  createdAt: string
  generatedBy: { name: string | null }
}>>([])
const loadingUpdates = ref(false)

// Fetch updates
const fetchUpdates = async () => {
  loadingUpdates.value = true
  try {
    const data = await $fetch(`/api/s/${spaceId.value}/${spaceSlug.value}/updates`)
    updates.value = data as any
  } catch (e) {
    console.error('Failed to fetch updates:', e)
  } finally {
    loadingUpdates.value = false
  }
}

// Publish/discard update
const handlePublishUpdate = async (updateId: string) => {
  try {
    await $fetch(`/api/s/${spaceId.value}/${spaceSlug.value}/updates/${updateId}`, {
      method: 'PATCH',
      body: { action: 'publish' },
    })
    await fetchUpdates()
  } catch (e: any) {
    alert('Failed to publish update: ' + (e.data?.message || e.message))
  }
}

const handleDiscardUpdate = async (updateId: string) => {
  try {
    await $fetch(`/api/s/${spaceId.value}/${spaceSlug.value}/updates/${updateId}`, {
      method: 'PATCH',
      body: { action: 'discard' },
    })
    await fetchUpdates()
  } catch (e: any) {
    alert('Failed to discard update: ' + (e.data?.message || e.message))
  }
}

// Fetch space overview
const fetchSpace = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const data = await $fetch(`/api/s/${spaceId.value}/${spaceSlug.value}`)
    space.value = data as SpaceData
    
    // Trigger page load animation
    setTimeout(() => {
      isPageLoaded.value = true
    }, 100)
  } catch (e: any) {
    if (e.statusCode === 401) {
      router.push('/login?redirect=' + encodeURIComponent(route.fullPath))
      return
    }
    if (e.statusCode === 403) {
      error.value = "You don't have access to this portal"
      return
    }
    error.value = e.data?.message || 'Failed to load portal'
  } finally {
    loading.value = false
  }
}

// Fetch my requests
const fetchMyRequests = async () => {
  loadingRequests.value = true
  try {
    const data = await $fetch(`/api/s/${spaceId.value}/${spaceSlug.value}/my-requests`)
    myRequests.value = data as any
  } catch (e) {
    console.error('Failed to fetch requests:', e)
  } finally {
    loadingRequests.value = false
  }
}

// Fetch Q&A items
const fetchQA = async () => {
  loadingQA.value = true
  try {
    const data = await $fetch(`/api/s/${spaceId.value}/${spaceSlug.value}/qa`, {
      query: {
        sort: qaSort.value,
        search: qaSearch.value || undefined
      }
    })
    qaItems.value = data as any
  } catch (e) {
    console.error('Failed to fetch Q&A:', e)
  } finally {
    loadingQA.value = false
  }
}

// Toggle vote on IR
const toggleVote = async (irId: string) => {
  try {
    const result = await $fetch(`/api/s/${spaceId.value}/${spaceSlug.value}/qa/${irId}/vote`, {
      method: 'POST'
    })
    
    const item = qaItems.value.find(i => i.id === irId)
    if (item) {
      item.hasVoted = (result as any).voted
      item.votes = (result as any).voteCount
    }
  } catch (e) {
    console.error('Failed to vote:', e)
  }
}

// Watch for tab changes to load data
watch(activeTab, (tab) => {
  if (tab === 'updates' && updates.value.length === 0) {
    fetchUpdates()
  }
  if (tab === 'requests' && !myRequests.value) {
    fetchMyRequests()
  }
  if (tab === 'qa' && qaItems.value.length === 0) {
    fetchQA()
  }
})

// Watch for Q&A filters
watch([qaSort, qaSearch], () => {
  if (activeTab.value === 'qa') {
    fetchQA()
  }
})

// Format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Status colors
const statusColor = (status: string) => {
  const colors: Record<string, string> = {
    todo: 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
    done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    blocked: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    answered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    declined: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
    rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
    needs_info: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
  }
  return colors[status.toLowerCase()] || 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400'
}

// Check auth and fetch space on mount
onMounted(async () => {
  await fetchUser()
  if (!isAuthenticated.value) {
    router.push('/login?redirect=' + encodeURIComponent(route.fullPath))
    return
  }
  await fetchSpace()
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-dm-surface dark:to-dm-surface">
    <!-- Navigation -->
    <nav class="fixed top-0 inset-x-0 z-50 bg-white/80 dark:bg-dm-surface/80 backdrop-blur-xl border-b border-slate-100 dark:border-white/[0.06]">
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <NuxtLink to="/dashboard" class="flex items-center gap-2 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors group">
            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-white/[0.1] transition-colors">
              <Icon name="heroicons:arrow-left" class="w-4 h-4" />
            </div>
          </NuxtLink>
          <div v-if="space" class="flex items-center gap-3">
            <div>
              <span class="font-semibold text-slate-900 dark:text-zinc-100">{{ space.name }}</span>
              <span class="text-slate-300 dark:text-zinc-600 mx-2">·</span>
              <span class="text-sm text-slate-500 dark:text-zinc-400">Stakeholder Portal</span>
            </div>
          </div>
        </div>
        
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-white/[0.04] rounded-full border border-slate-100 dark:border-white/[0.06]">
            <div class="w-6 h-6 bg-gradient-to-br from-violet-400 to-violet-500 rounded-full flex items-center justify-center">
              <span class="text-[10px] font-semibold text-white">
                {{ user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?' }}
              </span>
            </div>
            <span class="text-sm font-medium text-slate-700 dark:text-zinc-300">{{ space?.access?.displayName || user?.name || user?.email }}</span>
          </div>
          <button
            @click="logout"
            class="text-sm text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors px-3 py-1.5"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="pt-16">
      <!-- Loading -->
      <Transition
        enter-active-class="transition-opacity duration-300"
        leave-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="loading" class="flex flex-col items-center justify-center py-32 gap-4">
          <div class="relative">
            <div class="w-12 h-12 rounded-2xl bg-violet-100 dark:bg-violet-500/10 animate-pulse" />
            <Icon name="heroicons:arrow-path" class="absolute inset-0 m-auto w-6 h-6 text-violet-500 dark:text-violet-400 animate-spin" />
          </div>
          <p class="text-sm text-slate-400 dark:text-zinc-500">Loading portal...</p>
        </div>
      </Transition>

      <!-- Error -->
      <Transition
        enter-active-class="transition-all duration-300"
        enter-from-class="opacity-0 translate-y-4"
      >
        <div v-if="error && !loading" class="max-w-lg mx-auto mt-32 px-6">
          <div class="bg-white dark:bg-dm-card border border-slate-100 dark:border-white/[0.06] rounded-2xl p-10 text-center shadow-xl shadow-slate-100 dark:shadow-none">
            <div class="w-16 h-16 mx-auto mb-6 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center">
              <Icon name="heroicons:exclamation-circle" class="w-8 h-8 text-rose-400" />
            </div>
            <h2 class="text-xl font-semibold text-slate-900 dark:text-zinc-100 mb-2">Access Denied</h2>
            <p class="text-slate-500 dark:text-zinc-400 mb-8">{{ error }}</p>
            <NuxtLink 
              to="/dashboard"
              class="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white dark:text-dm text-white text-sm font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors"
            >
              <Icon name="heroicons:arrow-left" class="w-4 h-4" />
              Back to My Portals
            </NuxtLink>
          </div>
        </div>
      </Transition>

      <!-- Portal Content -->
      <Transition
        enter-active-class="transition-all duration-500 ease-out"
        enter-from-class="opacity-0"
      >
        <div v-if="space && !loading && !error">
          <!-- Header -->
          <div class="relative overflow-hidden">
            <!-- Subtle gradient background -->
            <div class="absolute inset-0 bg-gradient-to-b from-violet-50/50 dark:from-violet-500/[0.03] via-transparent to-transparent pointer-events-none" />
            
            <div class="relative max-w-6xl mx-auto px-6 pt-10 pb-6">
              <!-- Project info -->
              <div 
                :class="[
                  'transition-all duration-700 ease-out',
                  isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                ]"
              >
                <div class="flex items-start justify-between gap-6 mb-8">
                  <div class="flex-1">
                    <h1 class="text-3xl font-semibold text-slate-900 dark:text-zinc-100 mb-2 tracking-tight">{{ space.project.title }}</h1>
                    <p v-if="space.project.description" class="text-slate-500 dark:text-zinc-400 text-lg max-w-2xl leading-relaxed">
                      {{ space.project.description }}
                    </p>
                  </div>
                  
                  <!-- Stakeholders card -->
                  <button 
                    @click="showStakeholdersModal = true"
                    class="flex-shrink-0 bg-white dark:bg-dm-card rounded-2xl border border-slate-100 dark:border-white/[0.06] p-5 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none hover:border-slate-200 dark:hover:border-white/[0.1] transition-all group"
                  >
                    <div class="text-xs font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2 text-right">Stakeholders</div>
                    <div class="flex items-center gap-2">
                      <!-- Stacked avatars -->
                      <div class="flex -space-x-2">
                        <div 
                          v-for="(stakeholder, idx) in space.stakeholders.slice(0, 3)" 
                          :key="stakeholder.id"
                          class="w-8 h-8 bg-gradient-to-br from-violet-400 to-violet-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-dm-card"
                        >
                          <span class="text-xs font-semibold text-white">
                            {{ (stakeholder.displayName || stakeholder.name || stakeholder.email)[0].toUpperCase() }}
                          </span>
                        </div>
                        <div 
                          v-if="space.stakeholderCount > 3"
                          class="w-8 h-8 bg-slate-100 dark:bg-white/[0.08] rounded-full flex items-center justify-center ring-2 ring-white dark:ring-dm-card"
                        >
                          <span class="text-xs font-medium text-slate-500 dark:text-zinc-400">+{{ space.stakeholderCount - 3 }}</span>
                        </div>
                      </div>
                      <div class="flex items-center gap-1 text-sm font-medium text-slate-700 dark:text-zinc-300 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                        <span>{{ space.stakeholderCount }} {{ space.stakeholderCount === 1 ? 'person' : 'people' }}</span>
                        <Icon name="heroicons:chevron-right" class="w-4 h-4 text-slate-400 dark:text-zinc-500 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors" />
                      </div>
                    </div>
                  </button>
                </div>
                
                <!-- Your role badge -->
                <div v-if="space.access.position" class="inline-flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-500/10 rounded-full border border-violet-100 dark:border-violet-500/20">
                  <Icon name="heroicons:user-circle" class="w-4 h-4 text-violet-500 dark:text-violet-400" />
                  <span class="text-sm font-medium text-violet-700 dark:text-violet-400">{{ space.access.position }}</span>
                </div>
              </div>
            </div>

            <!-- Tabs -->
            <div 
              class="max-w-6xl mx-auto px-6"
              :class="[
                'transition-all duration-700 delay-100 ease-out',
                isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              ]"
            >
              <div class="flex items-center justify-between">
                <div class="flex gap-1 bg-slate-100/80 dark:bg-white/[0.04] p-1 rounded-xl w-fit">
                  <button
                    v-for="tab in [
                      { id: 'overview', label: 'Overview', icon: 'heroicons:home' },
                      { id: 'updates', label: 'Updates', icon: 'heroicons:megaphone' },
                      { id: 'requests', label: 'My Requests', icon: 'heroicons:inbox-arrow-down' },
                      { id: 'qa', label: 'Q&A', icon: 'heroicons:chat-bubble-left-right' }
                    ] as const"
                    :key="tab.id"
                    @click="activeTab = tab.id"
                    :class="[
                      'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                      activeTab === tab.id
                        ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 shadow-sm dark:shadow-none'
                        : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                    ]"
                  >
                    <Icon :name="tab.icon" class="w-4 h-4" />
                    {{ tab.label }}
                  </button>
                </div>
                <button
                  @click="chatOpen = true"
                  class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 text-violet-700 dark:text-violet-400 text-sm font-medium rounded-xl border border-violet-200/60 dark:border-violet-500/20 hover:from-violet-500/15 hover:to-fuchsia-500/15 hover:border-violet-300/60 dark:hover:border-violet-500/30 transition-all active:scale-95"
                >
                  <Icon name="heroicons:sparkles" class="w-4 h-4" />
                  AI Chat
                </button>
              </div>
            </div>
          </div>

          <!-- Tab Content -->
          <div class="max-w-6xl mx-auto px-6 py-8">
            <!-- Overview Tab -->
            <Transition
              mode="out-in"
              enter-active-class="transition-all duration-300 ease-out"
              leave-active-class="transition-all duration-200 ease-in"
              enter-from-class="opacity-0 translate-y-4"
              leave-to-class="opacity-0 -translate-y-4"
            >
              <div v-if="activeTab === 'overview'" key="overview" class="space-y-8">
                <!-- Activity + Stats Row -->
                <div
                  :class="[
                    'grid grid-cols-2 gap-4 transition-all duration-700 delay-200 ease-out',
                    isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  ]"
                >
                  <!-- Activity Tracker -->
                  <StakeholderActivityTracker
                    v-if="space.activityData"
                    :data="space.activityData"
                    :weeks="space.stats?.weeksTracked || 16"
                  />
                  
                  <!-- Stats Grid (2x2) -->
                  <div v-if="space.stats" class="grid grid-cols-2 gap-4">
                    <!-- Active Items -->
                    <div class="bg-white dark:bg-dm-card rounded-2xl border border-slate-100 dark:border-white/[0.06] p-5 shadow-sm dark:shadow-none flex items-center gap-4">
                      <div class="w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon name="heroicons:rectangle-stack" class="w-6 h-6 text-blue-500 dark:text-blue-400" />
                      </div>
                      <div>
                        <div class="text-2xl font-bold text-slate-900 dark:text-zinc-100">{{ space.stats.totalActive }}</div>
                        <div class="text-xs text-slate-500 dark:text-zinc-500 font-medium">Active Items</div>
                      </div>
                    </div>

                    <!-- Completed -->
                    <div class="bg-white dark:bg-dm-card rounded-2xl border border-slate-100 dark:border-white/[0.06] p-5 shadow-sm dark:shadow-none flex items-center gap-4">
                      <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon name="heroicons:check-circle" class="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                      </div>
                      <div>
                        <div class="text-2xl font-bold text-slate-900 dark:text-zinc-100">{{ space.stats.totalCompleted }}</div>
                        <div class="text-xs text-slate-500 dark:text-zinc-500 font-medium">Completed</div>
                      </div>
                    </div>

                    <!-- Avg Progress -->
                    <div class="bg-white dark:bg-dm-card rounded-2xl border border-slate-100 dark:border-white/[0.06] p-5 shadow-sm dark:shadow-none flex items-center gap-4">
                      <div class="w-12 h-12 bg-violet-50 dark:bg-violet-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon name="heroicons:chart-bar" class="w-6 h-6 text-violet-500 dark:text-violet-400" />
                      </div>
                      <div>
                        <div class="text-2xl font-bold text-slate-900 dark:text-zinc-100">{{ space.stats.avgProgress }}%</div>
                        <div class="text-xs text-slate-500 dark:text-zinc-500 font-medium">Avg Progress</div>
                      </div>
                    </div>

                    <!-- Avg Confidence -->
                    <div class="bg-white dark:bg-dm-card rounded-2xl border border-slate-100 dark:border-white/[0.06] p-5 shadow-sm dark:shadow-none flex items-center gap-4">
                      <div class="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Icon name="heroicons:signal" class="w-6 h-6 text-amber-500 dark:text-amber-400" />
                      </div>
                      <div>
                        <div class="text-2xl font-bold text-slate-900 dark:text-zinc-100">{{ space.stats.avgConfidence }}%</div>
                        <div class="text-xs text-slate-500 dark:text-zinc-500 font-medium">Avg Confidence</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Currently Working On -->
                <div
                  :class="[
                    'transition-all duration-700 delay-300 ease-out',
                    isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  ]"
                >
                  <StakeholderTaskTree
                    :tasks="space.activeTasks"
                    title="Currently Working On"
                    empty-message="No active items at the moment"
                    empty-icon="heroicons:sparkles"
                  />
                </div>

                <!-- Recently Completed -->
                <div
                  :class="[
                    'transition-all duration-700 delay-400 ease-out',
                    isPageLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  ]"
                >
                  <StakeholderCompletedTaskTree
                    :tasks="space.completedTasks"
                    title="Recently Completed"
                    empty-message="No completed items yet"
                    empty-icon="heroicons:check-badge"
                  />
                </div>
              </div>

              <!-- Updates Tab -->
              <div v-else-if="activeTab === 'updates'" key="updates">
                <div v-if="loadingUpdates" class="flex flex-col items-center justify-center py-20 gap-4">
                  <div class="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
                    <Icon name="heroicons:arrow-path" class="w-5 h-5 text-violet-500 dark:text-violet-400 animate-spin" />
                  </div>
                  <p class="text-sm text-slate-400 dark:text-zinc-500">Loading updates...</p>
                </div>

                <div v-else-if="updates.length === 0" class="bg-white dark:bg-dm-card border border-slate-100 dark:border-white/[0.06] rounded-2xl p-16 text-center shadow-sm dark:shadow-none">
                  <div class="w-20 h-20 mx-auto mb-6 bg-slate-50 dark:bg-white/[0.04] rounded-3xl flex items-center justify-center">
                    <Icon name="heroicons:megaphone" class="w-10 h-10 text-slate-300 dark:text-zinc-600" />
                  </div>
                  <h3 class="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-2">No updates yet</h3>
                  <p class="text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">Status updates from the team will appear here when published.</p>
                </div>

                <div v-else class="space-y-4">
                  <StakeholderUpdateCard
                    v-for="update in updates"
                    :key="update.id"
                    :update="update"
                    :is-team-member="space?.access?.isTeamMember"
                    :project-name="space?.project?.title"
                    @publish="handlePublishUpdate"
                    @discard="handleDiscardUpdate"
                  />
                </div>
              </div>

              <!-- My Requests Tab -->
              <div v-else-if="activeTab === 'requests'" key="requests">
                <div v-if="loadingRequests" class="flex flex-col items-center justify-center py-20 gap-4">
                  <div class="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
                    <Icon name="heroicons:arrow-path" class="w-5 h-5 text-violet-500 dark:text-violet-400 animate-spin" />
                  </div>
                  <p class="text-sm text-slate-400 dark:text-zinc-500">Loading requests...</p>
                </div>

                <div v-else-if="!myRequests || (myRequests.tasks.length === 0 && myRequests.irs.length === 0)" class="bg-white dark:bg-dm-card border border-slate-100 dark:border-white/[0.06] rounded-2xl p-16 text-center shadow-sm dark:shadow-none">
                  <div class="w-20 h-20 mx-auto mb-6 bg-slate-50 dark:bg-white/[0.04] rounded-3xl flex items-center justify-center">
                    <Icon name="heroicons:inbox" class="w-10 h-10 text-slate-300 dark:text-zinc-600" />
                  </div>
                  <h3 class="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-2">No requests yet</h3>
                  <p class="text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">Your submitted tasks and questions will appear here. Use the chat to submit new requests.</p>
                </div>
                
                <div v-else class="space-y-8">
                  <!-- Submitted Tasks -->
                  <section v-if="myRequests.tasks.length > 0">
                    <div class="flex items-center gap-3 mb-4">
                      <h2 class="text-sm font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">Submitted Tasks</h2>
                      <div class="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/[0.06] to-transparent" />
                    </div>
                    
                    <div class="space-y-4">
                      <div
                        v-for="task in myRequests.tasks"
                        :key="task.id"
                        class="bg-white dark:bg-dm-card border border-slate-100 dark:border-white/[0.06] rounded-2xl p-5 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none transition-shadow"
                      >
                        <div class="flex items-start justify-between gap-4 mb-3">
                          <div class="flex-1">
                            <h3 class="font-semibold text-slate-900 dark:text-zinc-100 mb-1">{{ task.title }}</h3>
                            <p class="text-sm text-slate-500 dark:text-zinc-400 line-clamp-2">{{ task.description }}</p>
                          </div>
                          <span :class="['text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap', statusColor(task.status)]">
                            {{ task.status === 'needs_info' ? 'Info needed' : task.status.replace('_', ' ') }}
                          </span>
                        </div>
                        
                        <!-- Status-specific messages -->
                        <div v-if="task.status === 'rejected' && task.rejectionReason" class="mt-3 p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl">
                          <p class="text-xs text-rose-600 dark:text-rose-400 font-medium mb-1">Reason for decline:</p>
                          <p class="text-sm text-rose-800 dark:text-rose-300">{{ task.rejectionReason }}</p>
                        </div>
                        
                        <div v-if="task.status === 'accepted'" class="mt-3 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
                          <p class="text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                            <Icon name="heroicons:check-circle" class="w-4 h-4" />
                            Accepted — this is now being worked on by the team
                          </p>
                        </div>
                        
                        <!-- Comments Thread -->
                        <div class="mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                          <p class="text-xs text-slate-400 dark:text-zinc-500 font-medium mb-3 uppercase tracking-wider">Conversation</p>

                          <div v-if="task.comments && task.comments.length > 0" class="space-y-2 mb-4">
                            <div
                              v-for="comment in task.comments"
                              :key="comment.id"
                              :class="[
                                'p-3 rounded-xl',
                                comment.isTeamMember ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 ml-4' : 'bg-slate-50 dark:bg-white/[0.04] mr-4'
                              ]"
                            >
                              <div class="flex items-center gap-2 mb-1">
                                <span :class="['text-xs font-semibold', comment.isTeamMember ? 'text-violet-700 dark:text-violet-400' : 'text-slate-700 dark:text-zinc-300']">
                                  {{ comment.authorName }}
                                </span>
                                <span v-if="comment.isTeamMember" class="text-[10px] px-1.5 py-0.5 bg-violet-200 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 rounded-full font-medium">
                                  Team
                                </span>
                                <span class="text-[10px] text-slate-400 dark:text-zinc-600">{{ formatDate(comment.createdAt) }}</span>
                              </div>
                              <p class="text-sm text-slate-700 dark:text-zinc-300">{{ comment.content }}</p>
                            </div>
                          </div>

                          <div v-else class="text-xs text-slate-400 dark:text-zinc-500 mb-4 py-4 text-center bg-slate-50 dark:bg-white/[0.04] rounded-xl">
                            No messages yet
                          </div>

                          <!-- Add comment input -->
                          <div class="flex gap-2">
                            <textarea
                              v-model="replyContent[`task-${task.id}`]"
                              rows="2"
                              placeholder="Add a comment..."
                              class="flex-1 px-4 py-3 text-sm border border-slate-200 dark:border-white/[0.06] rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none bg-slate-50 dark:bg-dm-card dark:text-zinc-200 dark:placeholder-zinc-500"
                            />
                            <button
                              @click="submitTaskComment(task.id)"
                              :disabled="!replyContent[`task-${task.id}`]?.trim() || submittingReply[`task-${task.id}`]"
                              class="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all self-end active:scale-95"
                            >
                              {{ submittingReply[`task-${task.id}`] ? '...' : 'Send' }}
                            </button>
                          </div>
                        </div>

                        <p class="text-xs text-slate-400 dark:text-zinc-600 mt-4">Submitted {{ formatDate(task.createdAt) }}</p>
                      </div>
                    </div>
                  </section>

                  <!-- My Questions -->
                  <section v-if="myRequests.irs.length > 0">
                    <div class="flex items-center gap-3 mb-4">
                      <h2 class="text-sm font-semibold text-slate-500 dark:text-zinc-500 uppercase tracking-wider">My Questions & Suggestions</h2>
                      <div class="h-px flex-1 bg-gradient-to-r from-slate-200 dark:from-white/[0.06] to-transparent" />
                    </div>
                    
                    <div class="space-y-4">
                      <div
                        v-for="ir in myRequests.irs"
                        :key="ir.id"
                        class="bg-white dark:bg-dm-card border border-slate-100 dark:border-white/[0.06] rounded-2xl p-5 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none transition-shadow"
                      >
                        <div class="flex items-start gap-4 mb-3">
                          <div class="flex-1">
                            <div class="flex items-center gap-2 mb-2">
                              <span class="text-xs text-slate-400 dark:text-zinc-500 uppercase font-medium">{{ ir.type }}</span>
                              <span :class="['text-xs font-medium px-2.5 py-1 rounded-full', statusColor(ir.status)]">
                                {{ ir.status }}
                              </span>
                            </div>
                            <p class="text-slate-900 dark:text-zinc-100">{{ ir.content }}</p>

                            <!-- Official Response -->
                            <div v-if="ir.response" class="mt-4 p-4 bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded-xl">
                              <p class="text-xs text-violet-600 dark:text-violet-400 font-semibold mb-2 uppercase tracking-wider">Official Response</p>
                              <p class="text-sm text-slate-700 dark:text-zinc-300">{{ ir.response }}</p>
                            </div>
                            
                            <!-- Comments Thread -->
                            <div class="mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.06]">
                              <p class="text-xs text-slate-400 dark:text-zinc-500 font-medium mb-3 uppercase tracking-wider">Conversation</p>

                              <div v-if="ir.comments && ir.comments.length > 0" class="space-y-2 mb-4">
                                <div
                                  v-for="comment in ir.comments"
                                  :key="comment.id"
                                  :class="[
                                    'p-3 rounded-xl',
                                    comment.isTeamMember ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 ml-4' : 'bg-slate-50 dark:bg-white/[0.04] mr-4'
                                  ]"
                                >
                                  <div class="flex items-center gap-2 mb-1">
                                    <span :class="['text-xs font-semibold', comment.isTeamMember ? 'text-violet-700 dark:text-violet-400' : 'text-slate-700 dark:text-zinc-300']">
                                      {{ comment.authorName }}
                                    </span>
                                    <span v-if="comment.isTeamMember" class="text-[10px] px-1.5 py-0.5 bg-violet-200 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 rounded-full font-medium">
                                      Team
                                    </span>
                                    <span class="text-[10px] text-slate-400 dark:text-zinc-600">{{ formatDate(comment.createdAt) }}</span>
                                  </div>
                                  <p class="text-sm text-slate-700 dark:text-zinc-300">{{ comment.content }}</p>
                                </div>
                              </div>

                              <div v-else class="text-xs text-slate-400 dark:text-zinc-500 mb-4 py-4 text-center bg-slate-50 dark:bg-white/[0.04] rounded-xl">
                                No messages yet
                              </div>

                              <!-- Add comment input -->
                              <div class="flex gap-2">
                                <textarea
                                  v-model="replyContent[`ir-${ir.id}`]"
                                  rows="2"
                                  placeholder="Add a comment..."
                                  class="flex-1 px-4 py-3 text-sm border border-slate-200 dark:border-white/[0.06] rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none bg-slate-50 dark:bg-dm-card dark:text-zinc-200 dark:placeholder-zinc-500"
                                />
                                <button
                                  @click="submitIRComment(ir.id)"
                                  :disabled="!replyContent[`ir-${ir.id}`]?.trim() || submittingReply[`ir-${ir.id}`]"
                                  class="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all self-end active:scale-95"
                                >
                                  {{ submittingReply[`ir-${ir.id}`] ? '...' : 'Send' }}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <p class="text-xs text-slate-400 dark:text-zinc-600">Asked {{ formatDate(ir.createdAt) }}</p>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <!-- Q&A Tab -->
              <div v-else-if="activeTab === 'qa'" key="qa">
                <!-- Filters -->
                <div class="flex items-center gap-4 mb-6">
                  <div class="relative flex-1 max-w-md">
                    <Icon name="heroicons:magnifying-glass" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
                    <input
                      v-model="qaSearch"
                      type="text"
                      placeholder="Search questions..."
                      class="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.06] rounded-xl text-sm dark:text-zinc-200 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                  <div class="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.04] p-1 rounded-lg">
                    <button
                      @click="qaSort = 'recent'"
                      :class="[
                        'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                        qaSort === 'recent' ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 shadow-sm dark:shadow-none' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                      ]"
                    >
                      Recent
                    </button>
                    <button
                      @click="qaSort = 'votes'"
                      :class="[
                        'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                        qaSort === 'votes' ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 shadow-sm dark:shadow-none' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                      ]"
                    >
                      Most Voted
                    </button>
                  </div>
                </div>

                <!-- Q&A List -->
                <div v-if="loadingQA" class="flex flex-col items-center justify-center py-20 gap-4">
                  <div class="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center">
                    <Icon name="heroicons:arrow-path" class="w-5 h-5 text-violet-500 dark:text-violet-400 animate-spin" />
                  </div>
                  <p class="text-sm text-slate-400 dark:text-zinc-500">Loading Q&A...</p>
                </div>

                <div v-else-if="qaItems.length === 0" class="bg-white dark:bg-dm-card border border-slate-100 dark:border-white/[0.06] rounded-2xl p-16 text-center shadow-sm dark:shadow-none">
                  <div class="w-20 h-20 mx-auto mb-6 bg-slate-50 dark:bg-white/[0.04] rounded-3xl flex items-center justify-center">
                    <Icon name="heroicons:chat-bubble-left-right" class="w-10 h-10 text-slate-300 dark:text-zinc-600" />
                  </div>
                  <h3 class="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-2">No questions yet</h3>
                  <p class="text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">Be the first to ask a question! Use the chat to submit your questions.</p>
                </div>
                
                <div v-else class="space-y-4">
                  <div
                    v-for="item in qaItems"
                    :key="item.id"
                    class="bg-white dark:bg-dm-card border border-slate-100 dark:border-white/[0.06] rounded-2xl p-5 shadow-sm dark:shadow-none hover:shadow-md dark:hover:shadow-none transition-shadow"
                  >
                    <div class="flex items-start gap-4">
                      <!-- Vote button -->
                      <button
                        @click="toggleVote(item.id)"
                        :class="[
                          'flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all active:scale-95',
                          item.hasVoted
                            ? 'bg-violet-100 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400'
                            : 'bg-slate-50 dark:bg-white/[0.04] text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-600 dark:hover:text-zinc-300'
                        ]"
                      >
                        <Icon name="heroicons:chevron-up" class="w-4 h-4" />
                        <span class="text-sm font-bold">{{ item.votes }}</span>
                      </button>

                      <!-- Content -->
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-2">
                          <span class="text-xs text-slate-400 dark:text-zinc-500 uppercase font-medium">{{ item.type }}</span>
                          <span :class="['text-xs font-medium px-2.5 py-1 rounded-full', statusColor(item.status)]">
                            {{ item.status }}
                          </span>
                        </div>
                        <p class="text-slate-900 dark:text-zinc-100 text-lg">{{ item.content }}</p>

                        <!-- Official Response -->
                        <div v-if="item.response" class="mt-4 p-4 bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 rounded-xl">
                          <p class="text-xs text-violet-600 dark:text-violet-400 font-semibold mb-2 uppercase tracking-wider">Official Response</p>
                          <p class="text-sm text-slate-700 dark:text-zinc-300">{{ item.response }}</p>
                        </div>
                        
                        <!-- Comments Thread -->
                        <div v-if="item.comments && item.comments.length > 0" class="mt-4 space-y-2">
                          <p class="text-xs text-slate-400 dark:text-zinc-500 font-medium uppercase tracking-wider">Discussion</p>
                          <div
                            v-for="comment in item.comments"
                            :key="comment.id"
                            :class="[
                              'p-3 rounded-xl text-sm',
                              comment.isTeamMember ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 ml-4' : 'bg-slate-50 dark:bg-white/[0.04] mr-4'
                            ]"
                          >
                            <div class="flex items-center gap-2 mb-1">
                              <span :class="['text-xs font-semibold', comment.isTeamMember ? 'text-violet-700 dark:text-violet-400' : 'text-slate-700 dark:text-zinc-300']">
                                {{ comment.authorName }}
                              </span>
                              <span v-if="comment.isTeamMember" class="text-[10px] px-1.5 py-0.5 bg-violet-200 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 rounded-full font-medium">
                                Team
                              </span>
                              <span class="text-[10px] text-slate-400 dark:text-zinc-600">{{ formatDate(comment.createdAt) }}</span>
                            </div>
                            <p class="text-slate-700 dark:text-zinc-300">{{ comment.content }}</p>
                          </div>
                        </div>

                        <!-- Meta -->
                        <div class="flex items-center gap-3 mt-4 text-xs text-slate-400 dark:text-zinc-500">
                          <span class="font-medium">{{ item.createdBy.displayName || 'Anonymous' }}</span>
                          <span v-if="item.createdBy.position">· {{ item.createdBy.position }}</span>
                          <span>· {{ formatDate(item.createdAt) }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </main>

    <!-- Stakeholder Chat -->
    <StakeholderChat
      v-if="space"
      :space-id="spaceId"
      :space-slug="spaceSlug"
      :is-open="chatOpen"
      :can-submit-tasks="space.access?.canSubmitTasks"
      @open="chatOpen = true"
      @close="chatOpen = false"
    />

    <!-- Stakeholders Modal -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div 
          v-if="showStakeholdersModal && space" 
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="showStakeholdersModal = false"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="showStakeholdersModal = false" />
          
          <!-- Modal -->
          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            leave-active-class="transition-all duration-150 ease-in"
            enter-from-class="opacity-0 scale-95 translate-y-4"
            leave-to-class="opacity-0 scale-95 translate-y-4"
          >
            <div
              v-if="showStakeholdersModal"
              class="relative bg-white dark:bg-dm-card rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <!-- Header -->
              <div class="px-6 py-5 border-b border-slate-100 dark:border-white/[0.06]">
                <div class="flex items-center justify-between">
                  <div>
                    <h2 class="text-lg font-semibold text-slate-900 dark:text-zinc-100">Stakeholders</h2>
                    <p class="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">{{ space.stakeholderCount }} {{ space.stakeholderCount === 1 ? 'person has' : 'people have' }} access to this portal</p>
                  </div>
                  <button
                    @click="showStakeholdersModal = false"
                    class="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <Icon name="heroicons:x-mark" class="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <!-- Stakeholder list -->
              <div class="px-6 py-4 max-h-[400px] overflow-y-auto">
                <div class="space-y-3">
                  <div 
                    v-for="stakeholder in space.stakeholders"
                    :key="stakeholder.id"
                    class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    <!-- Avatar -->
                    <div class="w-10 h-10 bg-gradient-to-br from-violet-400 to-violet-500 dark:from-violet-500 dark:to-violet-600 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span class="text-sm font-semibold text-white">
                        {{ (stakeholder.displayName || stakeholder.name || stakeholder.email)[0].toUpperCase() }}
                      </span>
                    </div>
                    
                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-slate-900 dark:text-zinc-100 truncate">
                        {{ stakeholder.displayName || stakeholder.name || stakeholder.email }}
                      </div>
                      <div class="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-500">
                        <span v-if="stakeholder.position" class="truncate">{{ stakeholder.position }}</span>
                        <span v-if="stakeholder.position" class="text-slate-300 dark:text-zinc-600">·</span>
                        <span class="flex-shrink-0">Joined {{ formatRelativeDate(stakeholder.joinedAt) }}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Empty state -->
                <div v-if="space.stakeholders.length === 0" class="text-center py-8">
                  <div class="w-12 h-12 mx-auto mb-3 bg-slate-100 dark:bg-white/[0.06] rounded-xl flex items-center justify-center">
                    <Icon name="heroicons:users" class="w-6 h-6 text-slate-400 dark:text-zinc-500" />
                  </div>
                  <p class="text-sm text-slate-500 dark:text-zinc-400">No stakeholders yet</p>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-16px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(16px);
}

.list-move {
  transition: transform 0.3s ease;
}
</style>
