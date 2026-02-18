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

const filteredMembers = computed(() => {
  let list = sortedMembers.value
  if (memberFilter.value === 'humans') list = list.filter((m: any) => !m.isAgent)
  else if (memberFilter.value === 'agents') list = list.filter((m: any) => m.isAgent)
  const q = memberSearch.value.trim().toLowerCase()
  if (!q) return list
  return list.filter((m: any) =>
    m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)
  )
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

const memberSearch = ref('')
const memberFilter = ref<'all' | 'humans' | 'agents'>('all')

const expandedMembers = ref<Set<string>>(new Set())
const memberViews = ref<Record<string, 'timeline' | 'tasks' | 'sessions'>>({})
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

const expandAllMembers = () => {
  const allIds = sortedMembers.value.map(member => member.userId)
  expandedMembers.value = new Set(allIds)

  const nextViews = { ...memberViews.value }
  const nextModes = { ...memberTimelineMode.value }
  for (const memberId of allIds) {
    if (!nextViews[memberId]) nextViews[memberId] = 'timeline'
    if (!nextModes[memberId]) nextModes[memberId] = 'daily'
  }
  memberViews.value = nextViews
  memberTimelineMode.value = nextModes
}

const collapseAllMembers = () => {
  expandedMembers.value = new Set()
}

const setMemberView = (memberId: string, view: 'timeline' | 'tasks' | 'sessions') => {
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
  if (session.activityType === 'AGENT_SESSION' && session.task) return session.task.title
  if (session.activityType === 'AGENT_SESSION') return 'Agent session'
  if (session.activityType === 'TASK' && session.task) return session.task.title
  if (session.lane) return LANE_LABELS[session.lane as keyof typeof LANE_LABELS] || session.lane
  return 'Unknown'
}

const getActivityIcon = (session: any) => {
  if (session.activityType === 'AGENT_SESSION') return 'heroicons:cpu-chip'
  if (session.activityType === 'TASK') return 'heroicons:bolt'
  if (session.lane) return LANE_ICONS[session.lane as keyof typeof LANE_ICONS]
  return 'heroicons:question-mark-circle'
}

const getActivityColor = (session: any) => {
  if (session.activityType === 'AGENT_SESSION') return 'violet'
  if (session.activityType === 'TASK') return 'emerald'
  if (session.lane === 'MEETING') return 'purple'
  if (session.lane === 'ADMIN') return 'amber'
  if (session.lane === 'LEARNING') return 'indigo'
  if (session.lane === 'BREAK') return 'sky'
  return 'slate'
}

const activityIconClassMap: Record<string, string> = {
  emerald: 'bg-emerald-100 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400',
  violet: 'bg-violet-100 text-violet-500 dark:bg-violet-500/10 dark:text-violet-400',
  purple: 'bg-purple-100 text-purple-500 dark:bg-purple-500/10 dark:text-purple-400',
  amber: 'bg-amber-100 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400',
  indigo: 'bg-indigo-100 text-indigo-500 dark:bg-indigo-500/10 dark:text-indigo-400',
  sky: 'bg-sky-100 text-sky-500 dark:bg-sky-500/10 dark:text-sky-400',
  slate: 'bg-slate-100 text-slate-500 dark:bg-white/[0.08] dark:text-zinc-400',
}

const isClickableSession = (session: any) =>
  session.task && (session.activityType === 'TASK' || session.activityType === 'AGENT_SESSION')

const getActivityIconClasses = (session: any) => {
  return activityIconClassMap[getActivityColor(session)] || activityIconClassMap.slate
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
  if (!task?.dueDate) return 'text-slate-300 dark:text-zinc-600'
  const meta = getItemEstimateMeta(task)
  if (meta.needsEstimate) return 'text-slate-400 dark:text-zinc-500'
  if (meta.missProb > 66) return 'text-rose-600'
  if (meta.missProb > 33) return 'text-amber-600'
  return 'text-slate-500 dark:text-zinc-400'
}
</script>

<template>
  <!-- Header -->
  <header class="relative z-10 px-6 py-5 flex flex-col gap-4 border-b border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-surface">
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
      <div>
        <h1 class="text-xl font-medium text-slate-900 dark:text-zinc-100">Team Focus</h1>
        <p class="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
          Focus timeline for the workspace team.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
          <span>Project:</span>
          <select
            v-model="selectedProjectId"
            class="text-sm border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-1.5 bg-white dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-zinc-600"
          >
            <option value="">All projects</option>
            <option v-for="project in (projectsData || [])" :key="project.id" :value="project.id">
              {{ project.title }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
          <span>Range:</span>
          <select
            v-model="daysBack"
            class="text-sm border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-1.5 bg-white dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-zinc-600"
          >
            <option v-for="option in daysOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
          <span>Sort:</span>
          <select
            v-model="sortBy"
            class="text-sm border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-1.5 bg-white dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-zinc-600"
          >
            <option v-for="option in sortOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>
    </div>
  </header>

  <div class="flex-1 overflow-auto px-6 pb-6">
    <div v-if="!isAdmin" class="py-16 text-center text-slate-500 dark:text-zinc-400">
      <Icon name="heroicons:lock-closed" class="w-10 h-10 mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
      <p class="text-sm">Only workspace owners and admins can view team focus timelines.</p>
    </div>

  <div v-else class="space-y-6 pt-6">
      <!-- Stats -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div class="bg-white dark:bg-dm-card rounded-xl p-4 border border-slate-200 dark:border-white/[0.06]">
          <p class="text-2xl font-semibold text-slate-900 dark:text-zinc-100">{{ stats.totalHours }}h</p>
          <p class="text-xs text-slate-500 dark:text-zinc-400">Total focused</p>
        </div>
        <div class="bg-white dark:bg-dm-card rounded-xl p-4 border border-slate-200 dark:border-white/[0.06]">
          <p class="text-2xl font-semibold text-emerald-600">{{ stats.taskHours }}h</p>
          <p class="text-xs text-slate-500 dark:text-zinc-400">On tasks</p>
          <p class="text-xs text-emerald-600 mt-1">{{ formatPercent(stats.taskHours, stats.totalHours) }} of focus time</p>
        </div>
        <div class="bg-white dark:bg-dm-card rounded-xl p-4 border border-slate-200 dark:border-white/[0.06]">
          <p class="text-2xl font-semibold text-purple-600">{{ stats.meetingHours }}h</p>
          <p class="text-xs text-slate-500 dark:text-zinc-400">In meetings</p>
          <p class="text-xs text-purple-600 mt-1">{{ formatPercent(stats.meetingHours, stats.totalHours) }} of focus time</p>
        </div>
        <div class="bg-white dark:bg-dm-card rounded-xl p-4 border border-slate-200 dark:border-white/[0.06]">
          <p class="text-2xl font-semibold text-slate-700 dark:text-zinc-300">{{ stats.sessions }}</p>
          <p class="text-xs text-slate-500 dark:text-zinc-400">Sessions</p>
        </div>
        <div class="bg-white dark:bg-dm-card rounded-xl p-4 border border-slate-200 dark:border-white/[0.06]">
          <p class="text-2xl font-semibold text-slate-700 dark:text-zinc-300">{{ stats.activeMembers }}</p>
          <p class="text-xs text-slate-500 dark:text-zinc-400">Active members</p>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="pending" class="text-center py-12 text-slate-400 dark:text-zinc-500">
        <Icon name="heroicons:arrow-path" class="w-6 h-6 mx-auto mb-2 animate-spin" />
        <p class="text-sm">Loading team focus…</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!members.length" class="text-center py-16 text-slate-400 dark:text-zinc-500">
        <Icon name="heroicons:clock" class="w-10 h-10 mx-auto mb-3" />
        <p class="text-sm">No focus sessions in this period.</p>
      </div>

      <!-- Member timelines -->
      <div v-else class="space-y-5">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/[0.08] p-1 text-xs">
              <button
                v-for="opt in ([{ value: 'all', label: 'All' }, { value: 'humans', label: 'Humans' }, { value: 'agents', label: 'Agents' }] as const)"
                :key="opt.value"
                class="px-3 py-1 rounded-full transition-colors"
                :class="memberFilter === opt.value ? 'bg-white dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200 shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'"
                @click="memberFilter = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
            <div class="relative">
              <Icon name="heroicons:magnifying-glass" class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                v-model="memberSearch"
                type="text"
                placeholder="Search members..."
                class="pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-white/[0.06] rounded-lg bg-white dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-zinc-600 focus:border-slate-300 w-52 placeholder-slate-400 dark:placeholder-zinc-500"
              />
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
              @click="collapseAllMembers"
            >
              Collapse all
            </button>
            <button
              class="inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
              @click="expandAllMembers"
            >
              Expand all
            </button>
          </div>
        </div>

        <div
          v-for="member in filteredMembers"
          :key="member.userId"
          class="bg-white dark:bg-dm-card rounded-2xl border border-slate-200 dark:border-white/[0.06] overflow-hidden"
        >
          <button
            class="w-full text-left px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
            @click="toggleMember(member.userId)"
          >
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/[0.06] flex items-center justify-center overflow-hidden flex-shrink-0">
                  <img v-if="member.avatar" :src="member.avatar" :alt="member.name" class="w-full h-full object-cover" />
                  <span v-else class="text-sm font-semibold text-slate-600 dark:text-zinc-400">
                    {{ member.name.charAt(0) }}
                  </span>
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">{{ member.name }}</span>
                    <span
                      v-if="member.isAgent"
                      class="text-[10px] uppercase tracking-wide bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium"
                    >
                      Agent
                    </span>
                    <span
                      v-if="selectedProjectId && member.isProjectAssignee === false"
                      class="text-[10px] uppercase tracking-wide bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full"
                    >
                      Unassigned
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                    <template v-if="member.isAgent">
                      {{ member.agentSessions?.length || 0 }} sessions · {{ member.totals.totalHours }}h worked
                    </template>
                    <template v-else>
                      {{ member.totals.sessions }} sessions · {{ member.totals.totalHours }}h focused
                    </template>
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

              <div class="flex items-center gap-4 text-xs text-slate-500 dark:text-zinc-400">
                <span class="text-emerald-600 font-medium">
                  {{ member.totals.taskHours }}h tasks · {{ formatPercent(member.totals.taskHours, member.totals.totalHours) }}
                </span>
                <span class="text-purple-600 font-medium">
                  {{ member.totals.meetingHours }}h meetings · {{ formatPercent(member.totals.meetingHours, member.totals.totalHours) }}
                </span>
                <Icon
                  :name="expandedMembers.has(member.userId) ? 'heroicons:chevron-up' : 'heroicons:chevron-down'"
                  class="w-4 h-4 text-slate-400 dark:text-zinc-500"
                />
              </div>
            </div>
          </button>

          <div v-if="expandedMembers.has(member.userId)" class="px-5 py-4 border-t border-slate-100 dark:border-white/[0.06]">
            <div class="flex items-center justify-between mb-4">
              <div class="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/[0.08] p-1 text-xs">
                <button
                  class="px-3 py-1 rounded-full transition-colors"
                  :class="memberViews[member.userId] !== 'tasks' ? 'bg-white dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200 shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'"
                  @click="setMemberView(member.userId, 'timeline')"
                >
                  Timeline
                </button>
                <button
                  class="px-3 py-1 rounded-full transition-colors"
                  :class="memberViews[member.userId] === 'tasks' ? 'bg-white dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200 shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'"
                  @click="setMemberView(member.userId, 'tasks')"
                >
                  Current tasks
                </button>
                <button
                  v-if="member.isAgent && member.agentSessions?.length"
                  class="px-3 py-1 rounded-full transition-colors"
                  :class="memberViews[member.userId] === 'sessions' ? 'bg-white dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200 shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'"
                  @click="setMemberView(member.userId, 'sessions')"
                >
                  Sessions
                </button>
              </div>
            </div>

            <div v-if="!memberViews[member.userId] || memberViews[member.userId] === 'timeline'">
              <div class="flex items-center justify-between mb-4">
                <div class="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-white/[0.08] p-1 text-xs">
                  <button
                    class="px-3 py-1 rounded-full transition-colors"
                    :class="memberTimelineMode[member.userId] !== 'weekly' ? 'bg-white dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200 shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'"
                    @click="setMemberTimelineMode(member.userId, 'daily')"
                  >
                    Daily
                  </button>
                  <button
                    class="px-3 py-1 rounded-full transition-colors"
                    :class="memberTimelineMode[member.userId] === 'weekly' ? 'bg-white dark:bg-white/[0.08] text-slate-700 dark:text-zinc-200 shadow-sm' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'"
                    @click="setMemberTimelineMode(member.userId, 'weekly')"
                  >
                    Weekly
                  </button>
                </div>
              </div>

              <div v-if="!member.timeline.length" class="text-sm text-slate-400 dark:text-zinc-500">
                No focus sessions in this period.
              </div>
              <div v-else-if="memberTimelineMode[member.userId] !== 'weekly'" class="space-y-6">
                <div v-for="day in member.timeline" :key="day.date">
                  <div class="flex items-center justify-between">
                    <h3 class="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
                      {{ formatDate(day.date) }}
                    </h3>
                    <span class="text-xs text-slate-400 dark:text-zinc-500 font-normal">
                      {{ formatSummaryDuration(day.sessions.reduce((sum: number, s: any) => sum + s.durationMins, 0)) }}
                    </span>
                  </div>

                  <div class="mt-3 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-slate-100 dark:border-white/[0.06] divide-y divide-slate-100 dark:divide-white/[0.06]">
                    <div
                      v-for="session in day.sessions"
                      :key="session.id"
                      class="flex items-start gap-4 px-4 py-3 transition-colors"
                      :class="[
                        session.isActive && 'bg-emerald-50 dark:bg-emerald-500/10',
                        isClickableSession(session)
                          ? 'hover:bg-white dark:hover:bg-white/[0.06] cursor-pointer'
                          : 'hover:bg-white/60 dark:hover:bg-white/[0.04]'
                      ]"
                      @click="isClickableSession(session) ? openTaskDetail(session.task) : null"
                    >
                      <span class="text-xs text-slate-400 dark:text-zinc-500 w-14 flex-shrink-0 pt-0.5 font-mono">
                        {{ formatTime(session.startedAt) }}
                      </span>

                      <div
                        class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        :class="getActivityIconClasses(session)"
                      >
                        <Icon :name="getActivityIcon(session)" class="w-4 h-4" />
                      </div>

                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
                            {{ getActivityLabel(session) }}
                          </span>
                          <span
                            v-if="session.endReason === 'COMPLETED'"
                            class="text-xs text-emerald-500 font-medium"
                          >Done</span>
                          <span
                            v-if="session.endReason === 'TERMINATED'"
                            class="text-xs text-slate-400 dark:text-zinc-500 font-medium"
                          >Ended</span>
                          <span
                            v-if="session.isActive"
                            class="text-xs text-emerald-500 font-medium animate-pulse"
                          >Active</span>
                          <span
                            v-if="session.agentSessionStatus === 'AWAITING_REVIEW'"
                            class="text-xs text-amber-500 font-medium"
                          >Awaiting review</span>
                        </div>

                        <p v-if="session.project && !selectedProjectId" class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                          {{ session.project.title }}
                        </p>
                        <p v-if="session.comment" class="text-xs text-slate-500 dark:text-zinc-400 mt-1 italic">
                          "{{ session.comment }}"
                        </p>
                      </div>

                      <div class="flex items-center gap-3 flex-shrink-0">
                        <span class="text-xs text-slate-500 dark:text-zinc-400">
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
                    <h3 class="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
                      {{ week.label }}
                    </h3>
                    <span class="text-xs text-slate-400 dark:text-zinc-500 font-normal">
                      {{ formatSummaryDuration(week.sessions.reduce((sum: number, s: any) => sum + s.durationMins, 0)) }}
                    </span>
                  </div>

                  <div class="mt-3 bg-slate-50 dark:bg-white/[0.04] rounded-xl border border-slate-100 dark:border-white/[0.06] divide-y divide-slate-100 dark:divide-white/[0.06]">
                    <div
                      v-for="session in week.sessions"
                      :key="session.id"
                      class="flex items-start gap-4 px-4 py-3 transition-colors"
                      :class="[
                        session.isActive && 'bg-emerald-50 dark:bg-emerald-500/10',
                        isClickableSession(session)
                          ? 'hover:bg-white dark:hover:bg-white/[0.06] cursor-pointer'
                          : 'hover:bg-white/60 dark:hover:bg-white/[0.04]'
                      ]"
                      @click="isClickableSession(session) ? openTaskDetail(session.task) : null"
                    >
                      <span class="text-xs text-slate-400 dark:text-zinc-500 w-20 flex-shrink-0 pt-0.5 font-mono">
                        {{ session.dayLabel }} {{ formatTime(session.startedAt) }}
                      </span>

                      <div
                        class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        :class="getActivityIconClasses(session)"
                      >
                        <Icon :name="getActivityIcon(session)" class="w-4 h-4" />
                      </div>

                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
                            {{ getActivityLabel(session) }}
                          </span>
                          <span
                            v-if="session.endReason === 'COMPLETED'"
                            class="text-xs text-emerald-500 font-medium"
                          >Done</span>
                          <span
                            v-if="session.endReason === 'TERMINATED'"
                            class="text-xs text-slate-400 dark:text-zinc-500 font-medium"
                          >Ended</span>
                          <span
                            v-if="session.isActive"
                            class="text-xs text-emerald-500 font-medium animate-pulse"
                          >Active</span>
                          <span
                            v-if="session.agentSessionStatus === 'AWAITING_REVIEW'"
                            class="text-xs text-amber-500 font-medium"
                          >Awaiting review</span>
                        </div>

                        <p v-if="session.project && !selectedProjectId" class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                          {{ session.project.title }}
                        </p>
                        <p v-if="session.comment" class="text-xs text-slate-500 dark:text-zinc-400 mt-1 italic">
                          "{{ session.comment }}"
                        </p>
                      </div>

                      <div class="flex items-center gap-3 flex-shrink-0">
                        <span class="text-xs text-slate-500 dark:text-zinc-400">
                          {{ formatDuration(session.durationMins) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="memberViews[member.userId] === 'tasks'">
              <div v-if="!member.currentTasks?.length" class="text-sm text-slate-400 dark:text-zinc-500">
                No current tasks assigned.
              </div>
              <div v-else class="space-y-2">
                <button
                  v-for="task in member.currentTasks"
                  :key="task.id"
                  class="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card hover:border-slate-300 dark:hover:border-white/[0.08] hover:shadow-sm transition-all"
                  @click="openTaskDetail(task)"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                        <span>{{ task.title }}</span>
                        <Icon
                          v-if="task.isOwner"
                          name="heroicons:star-solid"
                          class="w-3.5 h-3.5 text-amber-400"
                        />
                      </div>
                      <div class="text-xs text-slate-400 dark:text-zinc-500 mt-1 flex flex-wrap items-center gap-2">
                        <span class="truncate flex items-center gap-1.5">
                          {{ task.projectTitle }}
                          <Icon
                            v-if="task.projectOwnerId === member.userId"
                            name="heroicons:star-solid"
                            class="w-3 h-3 text-amber-300"
                          />
                        </span>
                        <span v-if="task.category" class="text-slate-300 dark:text-zinc-600">·</span>
                        <span v-if="task.category" class="text-slate-500 dark:text-zinc-400">{{ task.category }}</span>
                        <span v-if="task.dueDate" class="text-slate-300 dark:text-zinc-600">·</span>
                        <span v-if="task.dueDate" :class="getDueDateClass(task)">
                          Due {{ formatShortDate(task.dueDate) }}
                        </span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <span class="relative group/priority inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-white/[0.08] px-2 py-1 rounded-full">
                        <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover/priority:opacity-100 transition-opacity shadow-lg">
                          Priority
                        </span>
                        <span class="text-[9px] text-slate-400 dark:text-zinc-500 font-semibold">P</span>
                        <span class="w-1.5 h-1.5 rounded-full" :class="priorityDotColors[task.priority ?? 'MEDIUM'] || 'bg-slate-300 dark:bg-zinc-600'" />
                        {{ task.priority ? task.priority.charAt(0) + task.priority.slice(1).toLowerCase() : 'Medium' }}
                      </span>
                      <span class="relative group/complexity inline-flex items-center gap-1 text-[10px] text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-white/[0.08] px-2 py-1 rounded-full">
                        <span class="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover/complexity:opacity-100 transition-opacity shadow-lg">
                          Complexity
                        </span>
                        <span class="text-[9px] text-slate-400 dark:text-zinc-500 font-semibold">C</span>
                        <span class="w-1.5 h-1.5 rounded-full" :class="complexityDotColors[task.complexity ?? 'MEDIUM'] || 'bg-slate-300 dark:bg-zinc-600'" />
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

            <!-- Agent Sessions view -->
            <div v-else-if="memberViews[member.userId] === 'sessions'">
              <div v-if="!member.agentSessions?.length" class="text-sm text-slate-400 dark:text-zinc-500">
                No agent sessions recorded.
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="as in member.agentSessions"
                  :key="as.id"
                  class="px-4 py-3 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card transition-all"
                  :class="as.task ? 'hover:border-slate-300 dark:hover:border-white/[0.08] hover:shadow-sm cursor-pointer' : ''"
                  @click="as.task ? openTaskDetail(as.task) : null"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <Icon name="heroicons:cpu-chip" class="w-4 h-4 text-violet-500 flex-shrink-0" />
                        <span class="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
                          {{ as.task?.title || 'Unlinked session' }}
                        </span>
                      </div>
                      <div class="text-xs text-slate-400 dark:text-zinc-500 mt-1 ml-6">
                        {{ new Date(as.checkedOutAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                        at {{ new Date(as.checkedOutAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false }) }}
                        · {{ formatDuration(as.durationMins) }}
                      </div>
                    </div>
                    <div class="flex items-center gap-2 flex-shrink-0">
                      <span
                        class="text-[10px] uppercase tracking-wide px-2 py-1 rounded-full font-medium"
                        :class="{
                          'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400': as.status === 'AWAITING_REVIEW',
                          'bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 animate-pulse': as.status === 'ACTIVE',
                          'bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-zinc-400': as.status === 'TERMINATED',
                          'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400': as.status === 'IDLE',
                        }"
                      >
                        {{ as.status === 'AWAITING_REVIEW' ? 'Review' : as.status === 'ACTIVE' ? 'Active' : as.status === 'TERMINATED' ? 'Ended' : 'Idle' }}
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
