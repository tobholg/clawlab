<script setup lang="ts">
definePageMeta({
  layout: false,
})

const { currentUserId, LANE_LABELS, LANE_ICONS } = useFocus()

// Date range
const daysBack = ref(7)
const daysOptions = [7, 14, 30, 60, 90]

const { data: historyData, refresh, pending } = useFetch('/api/focus/history', {
  query: computed(() => ({ userId: currentUserId.value, days: daysBack.value })),
})

const timeline = computed(() => historyData.value?.timeline || [])
const timelineSorted = computed(() => {
  return timeline.value.map((day: any) => ({
    ...day,
    sessions: [...day.sessions].sort(
      (a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    ),
  }))
})

// Stats
const stats = computed(() => {
  let totalMins = 0
  let taskMins = 0
  let meetingMins = 0
  let sessions = 0

  for (const day of timeline.value) {
    for (const s of day.sessions) {
      sessions++
      totalMins += s.durationMins
      if (s.activityType === 'TASK') taskMins += s.durationMins
      if (s.lane === 'MEETING') meetingMins += s.durationMins
    }
  }

  return {
    totalHours: Math.round(totalMins / 60 * 10) / 10,
    taskHours: Math.round(taskMins / 60 * 10) / 10,
    meetingHours: Math.round(meetingMins / 60 * 10) / 10,
    sessions,
  }
})

// Edit comment state
const editingSessionId = ref<string | null>(null)
const editComment = ref('')

const startEditComment = (session: any) => {
  editingSessionId.value = session.id
  editComment.value = session.comment || ''
}

const cancelEdit = () => {
  editingSessionId.value = null
  editComment.value = ''
}

const saveComment = async (sessionId: string) => {
  try {
    await $fetch(`/api/focus/session/${sessionId}/comment`, {
      method: 'POST',
      body: { comment: editComment.value },
    })
    editingSessionId.value = null
    editComment.value = ''
    refresh()
  } catch (e) {
    console.error('Failed to save comment:', e)
  }
}

// Formatters
const formatTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  })
}

const formatDuration = (mins: number) => {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

const formatSummaryDuration = (mins: number) => {
  return formatDuration(mins)
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
    day: 'numeric'
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

// Activity color classes (avoids dynamic class generation)
const activityIconClasses = (session: any) => {
  if (session.activityType === 'TASK') return 'bg-emerald-100 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400'
  if (session.lane === 'MEETING') return 'bg-purple-100 text-purple-500 dark:bg-purple-500/10 dark:text-purple-400'
  if (session.lane === 'BREAK') return 'bg-sky-100 text-sky-500 dark:bg-sky-500/10 dark:text-sky-400'
  return 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-zinc-400'
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-dm-surface">
    <!-- Header -->
    <header class="bg-white dark:bg-dm-card border-b border-slate-200 dark:border-white/[0.06] sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <NuxtLink to="/workspace" class="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">
            <Icon name="heroicons:arrow-left" class="w-5 h-5" />
          </NuxtLink>
          <h1 class="text-lg font-medium text-slate-900 dark:text-zinc-100">Focus Timeline</h1>
        </div>

        <!-- Date range selector -->
        <div class="flex items-center gap-2">
          <span class="text-sm text-slate-500 dark:text-zinc-400">Show:</span>
          <select
            v-model="daysBack"
            class="text-sm border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-1.5 bg-white dark:bg-dm-card dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-zinc-600"
          >
            <option v-for="d in daysOptions" :key="d" :value="d">
              {{ d }} days
            </option>
          </select>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-6 py-8">
      <!-- Stats -->
      <div class="grid grid-cols-4 gap-4 mb-8">
        <div class="bg-white dark:bg-dm-card rounded-xl p-4 border border-slate-200 dark:border-white/[0.06]">
          <p class="text-2xl font-semibold text-slate-900 dark:text-zinc-100">{{ stats.totalHours }}h</p>
          <p class="text-xs text-slate-500 dark:text-zinc-500">Total focused</p>
        </div>
        <div class="bg-white dark:bg-dm-card rounded-xl p-4 border border-slate-200 dark:border-white/[0.06]">
          <p class="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">{{ stats.taskHours }}h</p>
          <p class="text-xs text-slate-500 dark:text-zinc-500">On tasks</p>
        </div>
        <div class="bg-white dark:bg-dm-card rounded-xl p-4 border border-slate-200 dark:border-white/[0.06]">
          <p class="text-2xl font-semibold text-purple-600 dark:text-purple-400">{{ stats.meetingHours }}h</p>
          <p class="text-xs text-slate-500 dark:text-zinc-500">In meetings</p>
        </div>
        <div class="bg-white dark:bg-dm-card rounded-xl p-4 border border-slate-200 dark:border-white/[0.06]">
          <p class="text-2xl font-semibold text-slate-600 dark:text-zinc-300">{{ stats.sessions }}</p>
          <p class="text-xs text-slate-500 dark:text-zinc-500">Sessions</p>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="pending" class="text-center py-12 text-slate-400 dark:text-zinc-500">
        <Icon name="heroicons:arrow-path" class="w-6 h-6 mx-auto mb-2 animate-spin" />
        <p class="text-sm">Loading...</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="!timeline.length" class="text-center py-12 text-slate-400 dark:text-zinc-500">
        <Icon name="heroicons:clock" class="w-10 h-10 mx-auto mb-3" />
        <p class="text-sm">No focus sessions in this period</p>
      </div>

      <!-- Timeline -->
      <div v-else class="space-y-8">
        <div v-for="day in timelineSorted" :key="day.date">
          <!-- Date header -->
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-sm font-medium text-slate-900 dark:text-zinc-100">
              {{ formatDate(day.date) }}
            </h2>
            <div class="text-xs text-slate-400 dark:text-zinc-500 font-normal">
              {{ formatSummaryDuration(day.sessions.reduce((sum: number, s: any) => sum + s.durationMins, 0)) }}
            </div>
          </div>

          <!-- Sessions -->
          <div class="bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06] divide-y divide-slate-100 dark:divide-white/[0.04]">
            <div
              v-for="session in day.sessions"
              :key="session.id"
              class="group flex items-start gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
              :class="session.isActive && 'bg-emerald-50 dark:bg-emerald-500/5'"
            >
              <!-- Time -->
              <span class="text-sm text-slate-400 dark:text-zinc-500 w-14 flex-shrink-0 pt-0.5 font-mono">
                {{ formatTime(session.startedAt) }}
              </span>

              <!-- Icon -->
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                :class="activityIconClasses(session)"
              >
                <Icon :name="getActivityIcon(session)" class="w-4 h-4" />
              </div>

              <!-- Content -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-slate-900 dark:text-zinc-200">
                    {{ getActivityLabel(session) }}
                  </span>
                  <span
                    v-if="session.endReason === 'COMPLETED'"
                    class="text-xs text-emerald-500 dark:text-emerald-400 font-medium"
                  >Done</span>
                  <span
                    v-if="session.isActive"
                    class="text-xs text-emerald-500 dark:text-emerald-400 font-medium animate-pulse"
                  >Active</span>
                </div>

                <!-- Project -->
                <p v-if="session.project" class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  {{ session.project.title }}
                </p>

                <!-- Comment display -->
                <div
                  v-if="session.comment && editingSessionId !== session.id"
                  class="mt-2 text-sm text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-white/[0.04] rounded-lg px-3 py-2"
                >
                  {{ session.comment }}
                </div>

                <!-- Comment edit -->
                <div v-if="editingSessionId === session.id" class="mt-2">
                  <textarea
                    v-model="editComment"
                    placeholder="What did you work on? Any notes?"
                    rows="2"
                    class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-zinc-200 dark:placeholder:text-zinc-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-zinc-600 resize-none"
                    @keyup.escape="cancelEdit"
                  />
                  <div class="flex gap-2 mt-2">
                    <button
                      @click="saveComment(session.id)"
                      class="px-3 py-1 text-xs font-medium bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg"
                    >Save</button>
                    <button
                      @click="cancelEdit"
                      class="px-3 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg"
                    >Cancel</button>
                  </div>
                </div>
              </div>

              <!-- Duration + Actions -->
              <div class="flex items-center gap-3 flex-shrink-0">
                <span class="text-sm text-slate-500 dark:text-zinc-500">
                  {{ formatDuration(session.durationMins) }}
                </span>
                <button
                  v-if="!editingSessionId"
                  @click="startEditComment(session)"
                  class="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded transition-all"
                  :title="session.comment ? 'Edit note' : 'Add note'"
                >
                  <Icon :name="session.comment ? 'heroicons:pencil' : 'heroicons:chat-bubble-left'" class="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
