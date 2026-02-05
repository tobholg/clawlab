<script setup lang="ts">
import { STATUS_CONFIG } from '~/types'
import { getItemEstimateMeta } from '~/utils/itemRisk'
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
const sortBy = ref('tasks_completed')
const sortOptions = [
  { value: 'tasks_completed', label: 'Most tasks completed' },
  { value: 'task_focus', label: 'Most task focus time' },
  { value: 'general', label: 'Most general time' },
  { value: 'meeting', label: 'Most meeting time' },
  { value: 'admin', label: 'Most admin time' },
  { value: 'learning', label: 'Most learning time' },
  { value: 'break', label: 'Most break time' },
]

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
const sortedMembers = computed(() => {
  const list = [...members.value]
  const getValue = (member: any) => {
    const totals = member.totals || {}
    switch (sortBy.value) {
      case 'tasks_completed':
        return totals.completedTasks ?? 0
      case 'task_focus':
        return totals.taskHours ?? 0
      case 'general':
        return totals.generalHours ?? 0
      case 'meeting':
        return totals.meetingHours ?? 0
      case 'admin':
        return totals.adminHours ?? 0
      case 'learning':
        return totals.learningHours ?? 0
      case 'break':
        return totals.breakHours ?? 0
      default:
        return totals.taskHours ?? 0
    }
  }
  return list.sort((a, b) => getValue(b) - getValue(a))
})
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
const memberViews = ref<Record<string, 'timeline' | 'tasks'>>({})
const memberTimelineMode = ref<Record<string, 'daily' | 'weekly'>>({})

const toggleMember = (memberId: string) => {
  const next = new Set(expandedMembers.value)
  if (next.has(memberId)) {
    next.delete(memberId)
  } else {
    next.add(memberId)
    if (!memberViews.value[memberId]) {
      memberViews.value[memberId] = 'timeline'
    }
    if (!memberTimelineMode.value[memberId]) {
      memberTimelineMode.value[memberId] = 'daily'
    }
  }
  expandedMembers.value = next
}

const setMemberView = (memberId: string, view: 'timeline' | 'tasks') => {
  memberViews.value = { ...memberViews.value, [memberId]: view }
}

const setMemberTimelineMode = (memberId: string, mode: 'daily' | 'weekly') => {
  memberTimelineMode.value = { ...memberTimelineMode.value, [memberId]: mode }
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

const getWeekStart = (dateStr: string) => {
  const date = new Date(dateStr)
  const day = date.getDay()
  const diff = (day + 6) % 7 // Monday start
  const start = new Date(date)
  start.setDate(date.getDate() - diff)
  start.setHours(0, 0, 0, 0)
  return start
}

const getWeekLabel = (weekStart: Date) => {
  const now = new Date()
  const currentStart = getWeekStart(now.toISOString())
  const lastStart = new Date(currentStart)
  lastStart.setDate(lastStart.getDate() - 7)

  if (weekStart.toDateString() === currentStart.toDateString()) return 'This week'
  if (weekStart.toDateString() === lastStart.toDateString()) return 'Last week'
  return `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

const buildWeeklyTimeline = (dailyTimeline: any[]) => {
  const weekMap = new Map<string, { weekStart: Date; sessions: any[] }>()

  for (const day of dailyTimeline) {
    const weekStart = getWeekStart(day.date)
    const weekKey = weekStart.toISOString().split('T')[0]
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { weekStart, sessions: [] })
    }
    const bucket = weekMap.get(weekKey)
    for (const session of day.sessions) {
      bucket.sessions.push({
        ...session,
        dayLabel: new Date(session.startedAt).toLocaleDateString('en-US', { weekday: 'short' }),
      })
    }
  }

  return Array.from(weekMap.values())
    .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
    .map((week) => ({
      weekStart: week.weekStart,
      label: getWeekLabel(week.weekStart),
      sessions: week.sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    }))
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

const priorityDotColors: Record<string, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-rose-500',
}

const complexityDotColors: Record<string, string> = {
  TRIVIAL: 'bg-emerald-500',
  SMALL: 'bg-green-500',
  MEDIUM: 'bg-amber-500',
  LARGE: 'bg-orange-500',
  EPIC: 'bg-rose-500',
}

const formatShortDate = (dateStr?: string | null) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getDueDateClass = (task: any) => {
  if (!task?.dueDate) return 'text-slate-300'
  const meta = getItemEstimateMeta(task)
  if (meta.needsEstimate) return 'text-slate-400'
  if (meta.missProb > 66) return 'text-rose-600'
  if (meta.missProb > 33) return 'text-amber-600'
  return 'text-slate-500'
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

        <div class="flex items-center gap-2 text-sm text-slate-500">
          <span>Sort:</span>
          <select
            v-model="sortBy"
            class="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            <option v-for="option in sortOptions" :key="option.value" :value="option.value">
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
          v-for="member in sortedMembers"
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
            <div class="flex items-center justify-between mb-4">
              <div class="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs">
                <button
                  class="px-3 py-1 rounded-full transition-colors"
                  :class="memberViews[member.userId] !== 'tasks' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
                  @click="setMemberView(member.userId, 'timeline')"
                >
                  Timeline
                </button>
                <button
                  class="px-3 py-1 rounded-full transition-colors"
                  :class="memberViews[member.userId] === 'tasks' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
                  @click="setMemberView(member.userId, 'tasks')"
                >
                  Current tasks
                </button>
              </div>
            </div>

            <div v-if="memberViews[member.userId] !== 'tasks'">
              <div class="flex items-center justify-between mb-4">
                <div class="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs">
                  <button
                    class="px-3 py-1 rounded-full transition-colors"
                    :class="memberTimelineMode[member.userId] !== 'weekly' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
                    @click="setMemberTimelineMode(member.userId, 'daily')"
                  >
                    Daily
                  </button>
                  <button
                    class="px-3 py-1 rounded-full transition-colors"
                    :class="memberTimelineMode[member.userId] === 'weekly' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
                    @click="setMemberTimelineMode(member.userId, 'weekly')"
                  >
                    Weekly
                  </button>
                </div>
              </div>

              <div v-if="!member.timeline.length" class="text-sm text-slate-400">
                No focus sessions in this period.
              </div>
              <div v-else-if="memberTimelineMode[member.userId] !== 'weekly'" class="space-y-6">
                <div v-for="day in member.timeline" :key="day.date">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {{ formatDate(day.date) }}
                    </h3>
                    <span class="text-xs text-slate-400 font-normal">
                      {{ formatSummaryDuration(day.sessions.reduce((sum: number, s: any) => sum + s.durationMins, 0)) }}
                    </span>
                  </div>

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
              <div v-else class="space-y-6">
                <div v-for="week in buildWeeklyTimeline(member.timeline)" :key="week.weekStart.toISOString()">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {{ week.label }}
                    </h3>
                    <span class="text-xs text-slate-400 font-normal">
                      {{ formatSummaryDuration(week.sessions.reduce((sum: number, s: any) => sum + s.durationMins, 0)) }}
                    </span>
                  </div>

                  <div class="mt-3 bg-slate-50 rounded-xl border border-slate-100 divide-y divide-slate-100">
                    <div
                      v-for="session in week.sessions"
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
                      <span class="text-xs text-slate-400 w-20 flex-shrink-0 pt-0.5 font-mono">
                        {{ session.dayLabel }} {{ formatTime(session.startedAt) }}
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

            <div v-else>
              <div v-if="!member.currentTasks?.length" class="text-sm text-slate-400">
                No current tasks assigned.
              </div>
              <div v-else class="space-y-2">
                <button
                  v-for="task in member.currentTasks"
                  :key="task.id"
                  class="w-full text-left px-4 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all"
                  @click="openTaskDetail(task)"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-sm font-medium text-slate-900 truncate flex items-center gap-1.5">
                        <span>{{ task.title }}</span>
                        <Icon
                          v-if="task.isOwner"
                          name="heroicons:star-solid"
                          class="w-3.5 h-3.5 text-amber-400"
                        />
                      </div>
                      <div class="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                        <span class="truncate flex items-center gap-1.5">
                          {{ task.projectTitle }}
                          <Icon
                            v-if="task.projectOwnerId === member.userId"
                            name="heroicons:star-solid"
                            class="w-3 h-3 text-amber-300"
                          />
                        </span>
                        <span v-if="task.category" class="text-slate-300">·</span>
                        <span v-if="task.category" class="text-slate-500">{{ task.category }}</span>
                        <span v-if="task.dueDate" class="text-slate-300">·</span>
                        <span v-if="task.dueDate" :class="getDueDateClass(task)">
                          Due {{ formatShortDate(task.dueDate) }}
                        </span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <span class="relative group/priority inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                        <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover/priority:opacity-100 transition-opacity shadow-lg">
                          Priority
                        </span>
                        <span class="text-[9px] text-slate-400 font-semibold">P</span>
                        <span class="w-1.5 h-1.5 rounded-full" :class="priorityDotColors[task.priority ?? 'MEDIUM'] || 'bg-slate-300'" />
                        {{ task.priority ? task.priority.charAt(0) + task.priority.slice(1).toLowerCase() : 'Medium' }}
                      </span>
                      <span class="relative group/complexity inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                        <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover/complexity:opacity-100 transition-opacity shadow-lg">
                          Complexity
                        </span>
                        <span class="text-[9px] text-slate-400 font-semibold">C</span>
                        <span class="w-1.5 h-1.5 rounded-full" :class="complexityDotColors[task.complexity ?? 'MEDIUM'] || 'bg-slate-300'" />
                        {{ task.complexity ? task.complexity.charAt(0) + task.complexity.slice(1).toLowerCase() : 'Medium' }}
                      </span>
                      <span
                        class="relative group/status text-[10px] uppercase tracking-wide px-2 py-1 rounded-full"
                        :class="STATUS_CONFIG[task.status]?.color || 'bg-slate-100 text-slate-500'"
                      >
                        <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover/status:opacity-100 transition-opacity shadow-lg">
                          Status
                        </span>
                        {{ STATUS_CONFIG[task.status]?.label || task.status?.replace('_', ' ') || 'Task' }}
                      </span>
                    </div>
                  </div>
                </button>
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
