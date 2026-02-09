<script setup lang="ts">
definePageMeta({
  layout: 'workspace',
  middleware: 'auth',
})

const router = useRouter()
const { workspaceId } = useItems()

const activities = ref<any[]>([])
const loading = ref(true)
const loadingMore = ref(false)
const nextCursor = ref<string | null>(null)
const filterType = ref('')

const typeFilters = [
  { value: '', label: 'All activity' },
  { value: 'CREATED', label: 'Created' },
  { value: 'STATUS_CHANGE', label: 'Status changes' },
  { value: 'PROGRESS_UPDATE', label: 'Progress updates' },
  { value: 'ASSIGNMENT', label: 'Assignments' },
  { value: 'COMMENT', label: 'Comments' },
  { value: 'DEPENDENCY_ADDED', label: 'Dependencies added' },
  { value: 'DEPENDENCY_REMOVED', label: 'Dependencies removed' },
]

const fetchActivities = async (append = false) => {
  if (!workspaceId.value) return

  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
    activities.value = []
  }

  try {
    const data = await $fetch('/api/activities', {
      query: {
        workspaceId: workspaceId.value,
        cursor: append ? nextCursor.value : undefined,
        type: filterType.value || undefined,
      }
    })
    if (append) {
      activities.value = [...activities.value, ...data.activities]
    } else {
      activities.value = data.activities
    }
    nextCursor.value = data.nextCursor
  } catch (e) {
    console.error('Failed to fetch activities:', e)
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

watch([workspaceId, filterType], () => fetchActivities(), { immediate: true })

// Group activities by date
const groupedActivities = computed(() => {
  const groups: { date: string; label: string; items: any[] }[] = []
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  for (const activity of activities.value) {
    const date = new Date(activity.createdAt)
    const dateStr = date.toDateString()

    let label: string
    if (dateStr === today) label = 'Today'
    else if (dateStr === yesterday) label = 'Yesterday'
    else label = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    const existing = groups.find(g => g.date === dateStr)
    if (existing) {
      existing.items.push(activity)
    } else {
      groups.push({ date: dateStr, label, items: [activity] })
    }
  }

  return groups
})

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'CREATED': return 'heroicons:plus-circle'
    case 'STATUS_CHANGE': return 'heroicons:arrow-path'
    case 'PROGRESS_UPDATE': return 'heroicons:chart-bar'
    case 'ASSIGNMENT': return 'heroicons:user-plus'
    case 'COMMENT': return 'heroicons:chat-bubble-left'
    case 'DEPENDENCY_ADDED': return 'heroicons:link'
    case 'DEPENDENCY_REMOVED': return 'heroicons:scissors'
    case 'UPDATED': return 'heroicons:pencil'
    default: return 'heroicons:bolt'
  }
}

const getActivityColor = (type: string) => {
  switch (type) {
    case 'CREATED': return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
    case 'STATUS_CHANGE': return 'text-blue-500 bg-blue-50 dark:bg-blue-500/10'
    case 'PROGRESS_UPDATE': return 'text-sky-500 bg-sky-50 dark:bg-sky-500/10'
    case 'ASSIGNMENT': return 'text-violet-500 bg-violet-50 dark:bg-violet-500/10'
    case 'COMMENT': return 'text-amber-500 bg-amber-50 dark:bg-amber-500/10'
    case 'DEPENDENCY_ADDED': return 'text-orange-500 bg-orange-50 dark:bg-orange-500/10'
    case 'DEPENDENCY_REMOVED': return 'text-red-500 bg-red-50 dark:bg-red-500/10'
    case 'UPDATED': return 'text-slate-500 bg-slate-50 dark:text-zinc-400 dark:bg-white/[0.04]'
    default: return 'text-slate-500 bg-slate-50 dark:text-zinc-400 dark:bg-white/[0.04]'
  }
}

const getActivityDescription = (activity: any) => {
  const name = activity.user.name || activity.user.email
  switch (activity.type) {
    case 'CREATED':
      return `${name} created this ${activity.item.isProject ? 'project' : 'task'}`
    case 'STATUS_CHANGE':
      return `${name} changed status from ${formatStatus(activity.oldValue)} to ${formatStatus(activity.newValue)}`
    case 'PROGRESS_UPDATE':
      return `${name} updated progress to ${activity.newValue}%`
    case 'ASSIGNMENT':
      return `${name} updated assignments`
    case 'COMMENT':
      return `${name} commented`
    case 'DEPENDENCY_ADDED':
      return `${name} added a dependency`
    case 'DEPENDENCY_REMOVED':
      return `${name} removed a dependency`
    case 'UPDATED':
      return `${name} updated this item`
    default:
      return `${name} made a change`
  }
}

const formatStatus = (status: string | null) => {
  if (!status) return '?'
  return status.replace(/_/g, ' ').toLowerCase()
}

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const navigateToItem = (item: any) => {
  if (item.isProject) {
    router.push(`/workspace/projects/${item.id}`)
  } else if (item.projectId) {
    router.push(`/workspace/projects/${item.projectId}`)
  }
}
</script>

<template>
  <header class="relative z-10 px-6 py-5">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-medium text-slate-900 dark:text-zinc-100">Activity</h1>
        <p class="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">Recent changes across your workspace</p>
      </div>

      <select
        v-model="filterType"
        class="text-sm border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-1.5 bg-white dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
      >
        <option v-for="f in typeFilters" :key="f.value" :value="f.value">{{ f.label }}</option>
      </select>
    </div>
  </header>

  <div class="flex-1 overflow-auto px-6 pb-6">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400 py-12 justify-center">
      <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
      Loading activity...
    </div>

    <!-- Empty -->
    <div v-else-if="!activities.length" class="py-12 text-center">
      <Icon name="heroicons:clock" class="w-8 h-8 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
      <p class="text-sm text-slate-500 dark:text-zinc-400">No activity yet</p>
    </div>

    <!-- Activity feed -->
    <div v-else class="max-w-3xl">
      <div v-for="group in groupedActivities" :key="group.date" class="mb-8">
        <div class="text-xs font-medium text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-3">
          {{ group.label }}
        </div>

        <div class="space-y-1">
          <div
            v-for="activity in group.items"
            :key="activity.id"
            class="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors group"
          >
            <!-- Icon -->
            <div
              :class="['w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', getActivityColor(activity.type)]"
            >
              <Icon :name="getActivityIcon(activity.type)" class="w-3.5 h-3.5" />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <p class="text-sm text-slate-700 dark:text-zinc-300">
                {{ getActivityDescription(activity) }}
              </p>
              <button
                @click="navigateToItem(activity.item)"
                class="text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-400 transition-colors mt-0.5 truncate block"
              >
                {{ activity.item.title }}
                <span v-if="activity.item.parentTitle"> &middot; {{ activity.item.parentTitle }}</span>
              </button>
            </div>

            <!-- Time -->
            <span class="text-xs text-slate-400 dark:text-zinc-500 flex-shrink-0 mt-0.5">
              {{ formatTime(activity.createdAt) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Load more -->
      <div v-if="nextCursor" class="text-center pt-4">
        <button
          @click="fetchActivities(true)"
          :disabled="loadingMore"
          class="text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
        >
          {{ loadingMore ? 'Loading...' : 'Load more' }}
        </button>
      </div>
    </div>
  </div>
</template>
