<script setup lang="ts">
definePageMeta({
  layout: 'workspace',
  middleware: 'auth',
})

const { workspaceId } = useItems()
const router = useRouter()
const { LANE_LABELS, LANE_ICONS } = useFocus()

const daysBack = ref(7)
const daysOptions = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last month' },
  { value: 90, label: 'Last quarter' },
]

const selectedProjectId = ref('')

const { data: membership, refresh: refreshMembership } = useFetch('/api/workspaces/membership', {
  query: computed(() => ({ workspaceId: workspaceId.value })),
  immediate: false,
})

const isAdmin = computed(() => {
  const role = membership.value?.role
  return role === 'OWNER' || role === 'ADMIN'
})

const { data: projectsData, refresh: refreshProjects } = useFetch('/api/items', {
  query: computed(() => ({ workspaceId: workspaceId.value, parentId: 'root' })),
  immediate: false,
})

const { data: teamHistory, pending, refresh: refreshTeamHistory } = useFetch('/api/focus/team-history', {
  query: computed(() => ({
    workspaceId: workspaceId.value,
    days: daysBack.value,
    projectId: selectedProjectId.value || undefined,
  })),
  immediate: false,
})

const members = computed(() => teamHistory.value?.members ?? [])
const stats = computed(() => teamHistory.value?.stats ?? {
  totalHours: 0,
  taskHours: 0,
  meetingHours: 0,
  sessions: 0,
  activeMembers: 0,
})

watch(workspaceId, (id) => {
  if (!id) return
  refreshMembership()
  refreshProjects()
}, { immediate: true })

watch([daysBack, selectedProjectId, isAdmin, workspaceId], () => {
  if (workspaceId.value && isAdmin.value) {
    refreshTeamHistory()
  }
}, { immediate: true })

const expandedMembers = ref<Set<string>>(new Set())

const toggleMember = (memberId: string) => {
  const next = new Set(expandedMembers.value)
  if (next.has(memberId)) {
    next.delete(memberId)
  } else {
    next.add(memberId)
  }
  expandedMembers.value = next
}

const showDetailModal = ref(false)
const selectedItem = ref<any>(null)

const openTaskDetail = (task: { id: string; title?: string }) => {
  selectedItem.value = task
  showDetailModal.value = true
}

const handleUpdateItem = async (_id: string, data: any) => {
  if (data?._close) {
    showDetailModal.value = false
  }
  await refreshTeamHistory()
}

const handleViewFull = (item: any) => {
  router.push(`/workspace/projects/${item.id}`)
}

const formatTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  })
}

const formatDuration = (mins: number) => {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const formatSummaryDuration = (mins: number) => {
  if (mins < 60) return `${mins} min`
  const hours = Math.round((mins / 60) * 10) / 10
  return `${hours} hours`
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

const getActivityLabel = (session: any) => {
  if (session.activityType === 'TASK' && session.task) return session.task.title
  if (session.lane) return LANE_LABELS[session.lane as keyof typeof LANE_LABELS] || session.lane
  return 'Unknown'
}

const getActivityIcon = (session: any) => {
  if (session.activityType === 'TASK') return 'heroicons:bolt'
  if (session.lane) return LANE_ICONS[session.lane as keyof typeof LANE_ICONS]
  return 'heroicons:question-mark-circle'
}

const getActivityColor = (session: any) => {
  if (session.activityType === 'TASK') return 'emerald'
  if (session.lane === 'MEETING') return 'purple'
  if (session.lane === 'ADMIN') return 'amber'
  if (session.lane === 'LEARNING') return 'indigo'
  if (session.lane === 'BREAK') return 'sky'
  return 'slate'
}

const formatPercent = (part: number, total: number) => {
  if (!total || total <= 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}
</script>

<template>
  <!-- Header -->
  <header class="relative z-10 px-6 py-5 flex flex-col gap-4 border-b border-slate-200 bg-white">
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-xl font-medium text-slate-900">Team Focus</h1>
        <p class="text-sm text-slate-500 mt-0.5">
          Focus timeline for the workspace team.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2 text-sm text-slate-500">
          <span>Project:</span>
          <select
            v-model="selectedProjectId"
            class="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option value="">All projects</option>
            <option v-for="project in (projectsData || [])" :key="project.id" :value="project.id">
              {{ project.title }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2 text-sm text-slate-500">
          <span>Range:</span>
          <select
            v-model="daysBack"
            class="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option v-for="option in daysOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </header>

  <div class="flex-1 overflow-auto px-6 pb-8">
    <div v-if="!isAdmin" class="py-16 text-center text-slate-500">
      <Icon name="heroicons:lock-closed" class="w-10 h-10 mx-auto mb-4 text-slate-300" />
      <p class="text-sm">Only workspace owners and admins can view team focus timelines.</p>
    </div>

  <div v-else class="space-y-6 pt-6">
      <!-- Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="bg-white rounded-xl p-4 border border-slate-200">
          <p class="text-2xl font-semibold text-slate-900">{{ stats.totalHours }}h</p>
          <p class="text-xs text-slate-500">Total focused</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-slate-200">
          <p class="text-2xl font-semibold text-emerald-600">{{ stats.taskHours }}h</p>
          <p class="text-xs text-slate-500">On tasks</p>
          <p class="text-xs text-emerald-600 mt-1">{{ formatPercent(stats.taskHours, stats.totalHours) }} of focus time</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-slate-200">
          <p class="text-2xl font-semibold text-purple-600">{{ stats.meetingHours }}h</p>
          <p class="text-xs text-slate-500">In meetings</p>
          <p class="text-xs text-purple-600 mt-1">{{ formatPercent(stats.meetingHours, stats.totalHours) }} of focus time</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-slate-200">
          <p class="text-2xl font-semibold text-slate-700">{{ stats.sessions }}</p>
          <p class="text-xs text-slate-500">Sessions</p>
        </div>
        <div class="bg-white rounded-xl p-4 border border-slate-200">
          <p class="text-2xl font-semibold text-slate-700">{{ stats.activeMembers }}</p>
          <p class="text-xs text-slate-500">Active members</p>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="pending" class="text-center py-12 text-slate-400">
        <Icon name="heroicons:arrow-path" class="w-6 h-6 mx-auto mb-2 animate-spin" />
        <p class="text-sm">Loading team focus…</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!members.length" class="text-center py-16 text-slate-400">
        <Icon name="heroicons:clock" class="w-10 h-10 mx-auto mb-3" />
        <p class="text-sm">No focus sessions in this period.</p>
      </div>

      <!-- Member timelines -->
      <div v-else class="space-y-5">
        <div
          v-for="member in members"
          :key="member.userId"
          class="bg-white rounded-2xl border border-slate-200 overflow-hidden"
        >
          <button
            class="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
            @click="toggleMember(member.userId)"
          >
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img v-if="member.avatar" :src="member.avatar" :alt="member.name" class="w-full h-full object-cover" />
                  <span v-else class="text-sm font-semibold text-slate-600">
                    {{ member.name.charAt(0) }}
                  </span>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-semibold text-slate-900 truncate">{{ member.name }}</span>
                    <span
                      v-if="selectedProjectId && member.isProjectAssignee === false"
                      class="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"
                    >
                      Unassigned
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">
                    {{ member.totals.sessions }} sessions · {{ member.totals.totalHours }}h focused
                  </p>
                  <div class="mt-3">
                    <UiUserCompletionHeatmap
                      :workspace-id="workspaceId"
                      :user-id="member.userId"
                      :project-id="selectedProjectId || null"
                      :days="14"
                    />
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-4 text-xs text-slate-500">
                <span class="text-emerald-600 font-medium">
                  {{ member.totals.taskHours }}h tasks · {{ formatPercent(member.totals.taskHours, member.totals.totalHours) }}
                </span>
                <span class="text-purple-600 font-medium">
                  {{ member.totals.meetingHours }}h meetings · {{ formatPercent(member.totals.meetingHours, member.totals.totalHours) }}
                </span>
                <Icon
                  :name="expandedMembers.has(member.userId) ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
                  class="w-4 h-4 text-slate-400"
                />
              </div>
            </div>
          </button>

          <div v-if="expandedMembers.has(member.userId)" class="px-5 py-4 border-t border-slate-100">
            <div v-if="!member.timeline.length" class="text-sm text-slate-400">
              No focus sessions in this period.
            </div>
            <div v-else class="space-y-6">
              <div v-for="day in member.timeline" :key="day.date">
                <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                  {{ formatDate(day.date) }}
                  <span class="text-slate-400 font-normal">
                    · {{ formatSummaryDuration(day.sessions.reduce((sum: number, s: any) => sum + s.durationMins, 0)) }}
                  </span>
                </h3>

                <div class="mt-3 bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
                  <div
                    v-for="session in day.sessions"
                    :key="session.id"
                    class="flex items-start gap-4 px-4 py-3 transition-colors"
                    :class="[
                      session.isActive && 'bg-emerald-50',
                      session.activityType === 'TASK' && session.task
                        ? 'hover:bg-white cursor-pointer'
                        : 'hover:bg-white/60'
                    ]"
                    @click="session.activityType === 'TASK' && session.task ? openTaskDetail(session.task) : null"
                  >
                    <span class="text-xs text-slate-400 w-14 flex-shrink-0 pt-0.5 font-mono">
                      {{ formatTime(session.startedAt) }}
                    </span>

                    <div
                      class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      :class="`bg-${getActivityColor(session)}-100 text-${getActivityColor(session)}-500`"
                    >
                      <Icon :name="getActivityIcon(session)" class="w-4 h-4" />
                    </div>

                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-sm font-medium text-slate-900 truncate">
                          {{ getActivityLabel(session) }}
                        </span>
                        <span
                          v-if="session.endReason === 'COMPLETED'"
                          class="text-xs text-emerald-500 font-medium"
                        >Done</span>
                        <span
                          v-if="session.isActive"
                          class="text-xs text-emerald-500 font-medium animate-pulse"
                        >Active</span>
                      </div>

                      <p v-if="session.project && !selectedProjectId" class="text-xs text-slate-400 mt-0.5">
                        {{ session.project.title }}
                      </p>
                      <p v-if="session.comment" class="text-xs text-slate-500 mt-1 italic">
                        “{{ session.comment }}”
                      </p>
                    </div>

                    <div class="flex items-center gap-3 flex-shrink-0">
                      <span class="text-xs text-slate-500">
                        {{ formatDuration(session.durationMins) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <ItemsItemDetailModal
    :open="showDetailModal"
    :item="selectedItem"
    @close="showDetailModal = false"
    @update="handleUpdateItem"
    @view-full="handleViewFull"
    @deleted="showDetailModal = false"
  />
</template>
