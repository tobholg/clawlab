<script setup lang="ts">
const { currentUserId, LANE_LABELS, LANE_ICONS } = useFocus()

const { data: historyData, refresh } = useFetch('/api/focus/history', {
  query: { userId: currentUserId.value, days: 7 },
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

// Format time
const formatTime = (iso: string) => {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false
  })
}

// Format duration
const formatDuration = (mins: number) => {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

// Format date
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

// Get activity label
const getActivityLabel = (session: any) => {
  if (session.activityType === 'TASK' && session.task) {
    return session.task.title
  }
  if (session.lane) {
    return LANE_LABELS[session.lane as keyof typeof LANE_LABELS] || session.lane
  }
  return 'Unknown'
}

// Get activity icon
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
  <div class="space-y-6">
    <!-- Empty state -->
    <div v-if="!timeline.length" class="text-center py-12 text-slate-400 dark:text-zinc-500">
      <Icon name="heroicons:clock" class="w-8 h-8 mx-auto mb-2" />
      <p class="text-sm">No focus sessions yet</p>
    </div>

    <!-- Timeline by day -->
    <div v-for="day in timelineSorted" :key="day.date" class="space-y-2">
      <!-- Date header -->
      <div class="flex items-center justify-between px-1">
        <h3 class="text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
          {{ formatDate(day.date) }}
        </h3>
        <span class="text-[11px] text-slate-400 dark:text-zinc-500">
          {{ formatDuration(day.sessions.reduce((sum: number, s: any) => sum + s.durationMins, 0)) }}
        </span>
      </div>

      <!-- Sessions -->
      <div class="space-y-1">
        <div
          v-for="session in day.sessions"
          :key="session.id"
          class="group relative"
        >
          <!-- Session row -->
          <div
            class="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
            :class="session.isActive && 'bg-emerald-50 dark:bg-emerald-500/5'"
          >
            <!-- Time -->
            <span class="text-xs text-slate-400 dark:text-zinc-500 w-12 flex-shrink-0 pt-0.5">
              {{ formatTime(session.startedAt) }}
            </span>

            <!-- Icon -->
            <div
              class="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
              :class="activityIconClasses(session)"
            >
              <Icon :name="getActivityIcon(session)" class="w-3.5 h-3.5" />
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="text-sm text-slate-900 dark:text-zinc-200 truncate">
                  {{ getActivityLabel(session) }}
                </span>
                <span
                  v-if="session.endReason === 'COMPLETED'"
                  class="text-emerald-500 dark:text-emerald-400 text-xs"
                >&#10003;</span>
                <span
                  v-if="session.isActive"
                  class="text-emerald-500 dark:text-emerald-400 text-[10px] font-medium uppercase"
                >Active</span>
              </div>

              <!-- Project context -->
              <p v-if="session.project" class="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                {{ session.project.title }}
              </p>

              <!-- Comment display -->
              <div
                v-if="session.comment && editingSessionId !== session.id"
                class="mt-1 text-xs text-slate-500 dark:text-zinc-400 italic flex items-start gap-1"
              >
                <Icon name="heroicons:chat-bubble-left" class="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{{ session.comment }}</span>
              </div>

              <!-- Comment edit -->
              <div v-if="editingSessionId === session.id" class="mt-2">
                <input
                  v-model="editComment"
                  type="text"
                  placeholder="Add a note..."
                  class="w-full px-2 py-1 text-xs border border-slate-200 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-zinc-200 dark:placeholder:text-zinc-600 rounded focus:outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-zinc-600"
                  @keyup.enter="saveComment(session.id)"
                  @keyup.escape="cancelEdit"
                />
                <div class="flex gap-1 mt-1">
                  <button
                    @click="saveComment(session.id)"
                    class="px-2 py-0.5 text-[10px] bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded"
                  >Save</button>
                  <button
                    @click="cancelEdit"
                    class="px-2 py-0.5 text-[10px] text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded"
                  >Cancel</button>
                </div>
              </div>
            </div>

            <!-- Duration + Actions -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs text-slate-400 dark:text-zinc-500">
                {{ formatDuration(session.durationMins) }}
              </span>
              <button
                v-if="!editingSessionId"
                @click="startEditComment(session)"
                class="opacity-0 group-hover:opacity-100 p-1 text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-400 transition-opacity"
                title="Add note"
              >
                <Icon name="heroicons:pencil" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
