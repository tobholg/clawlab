<script setup lang="ts">
import type { AgentActivity } from '~/composables/useWebSocket'

type ProviderKey = 'openclaw' | 'codex' | 'cursor' | 'custom'

interface ProviderPalette {
  label: string
  accent: string
}

const PROVIDER_PALETTE: Record<ProviderKey, ProviderPalette> = {
  openclaw: {
    label: 'OpenClaw',
    accent: '#f59e0b',
  },
  codex: {
    label: 'Codex',
    accent: '#10b981',
  },
  cursor: {
    label: 'Cursor',
    accent: '#3b82f6',
  },
  custom: {
    label: 'Custom',
    accent: '#64748b',
  },
}

const router = useRouter()
const now = ref(Date.now())
let relativeTick: ReturnType<typeof setInterval> | null = null

const {
  agentActivities,
  dismissAgentActivity,
  clearAllAgentActivities,
} = useWebSocket()

const containerHovered = ref(false)

const normalizeProvider = (provider?: string | null): ProviderKey => {
  const normalized = provider?.toLowerCase()
  if (normalized === 'openclaw' || normalized === 'codex' || normalized === 'cursor') {
    return normalized
  }
  return 'custom'
}

const providerPalette = (provider?: string | null) => PROVIDER_PALETTE[normalizeProvider(provider)]

const normalizeValue = (value?: string) => (value?.trim() || 'Unknown')

const buildActivityLabel = (activity: AgentActivity) => {
  const detail = activity.detail || {}
  switch (activity.action) {
    case 'channel_message':
      return detail.title?.trim()
        ? `Posted: ${detail.title}`
        : 'Posted a channel message'
    case 'status_change':
      return `Status changed: ${normalizeValue(detail.oldValue)} → ${normalizeValue(detail.newValue)}`
    case 'progress_update':
      return `Progress updated: ${normalizeValue(detail.oldValue)} → ${normalizeValue(detail.newValue)}`
    case 'substatus_change':
      return `Stage changed: ${normalizeValue(detail.oldValue)} → ${normalizeValue(detail.newValue)}`
    case 'field_updated': {
      const fieldName = detail.field?.trim() || 'Field'
      return `${fieldName} updated: ${normalizeValue(detail.oldValue)} → ${normalizeValue(detail.newValue)}`
    }
    case 'subtask_created':
      return `Created subtask: ${normalizeValue(detail.title)}`
    case 'subtask_deleted':
      return `Removed subtask: ${normalizeValue(detail.title)}`
    case 'comment_added':
      return `Commented: ${normalizeValue(detail.title)}`
    case 'doc_created':
      return `Created document: ${normalizeValue(detail.title)}`
    case 'doc_updated':
      return `Updated document: ${normalizeValue(detail.title)} (${normalizeValue(detail.newValue)})`
    default:
      return 'Updated task'
  }
}

const buildPathLabel = (activity: AgentActivity) => {
  if (activity.channel?.name) {
    return `#${activity.channel.name}`
  }
  if (activity.project?.title) {
    return `${activity.project.title} > ${activity.task?.title || 'Task'}`
  }
  return activity.task?.title || 'Task'
}

const formatRelativeTime = (timestamp?: string, fallbackMs?: number) => {
  const parsed = timestamp ? Date.parse(timestamp) : NaN
  const referenceMs = Number.isFinite(parsed) ? parsed : (fallbackMs || now.value)
  const deltaSec = Math.max(0, Math.floor((now.value - referenceMs) / 1000))
  if (deltaSec < 60) return 'Just now'
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m ago`
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h ago`
  return `${Math.floor(deltaSec / 86400)}d ago`
}

const { openTask } = useTaskDetail()

const navigateToTask = async (activity: AgentActivity) => {
  if (activity.action === 'channel_message' && activity.channel?.id) {
    try {
      await router.push(`/workspace/channels/${activity.channel.id}`)
    } catch { /* navigation cancelled */ }
    return
  }

  if (!activity.project?.id) return
  try {
    await router.push(`/workspace/projects/${activity.project.id}`)
  } catch { /* navigation cancelled */ }
  if (activity.task?.id) {
    openTask(activity.task.id, activity.project.id)
  }
}

// Swipe-to-dismiss state
const swipeState = reactive<Record<string, { startX: number; currentX: number; swiping: boolean }>>({})

const onPointerDown = (id: string, e: PointerEvent) => {
  swipeState[id] = { startX: e.clientX, currentX: e.clientX, swiping: false }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

const onPointerMove = (id: string, e: PointerEvent) => {
  const s = swipeState[id]
  if (!s) return
  s.currentX = e.clientX
  const dx = s.currentX - s.startX
  if (dx > 8) s.swiping = true
}

const getSwipeTranslate = (id: string) => {
  const s = swipeState[id]
  if (!s?.swiping) return 0
  return Math.max(0, s.currentX - s.startX)
}

const getSwipeOpacity = (id: string) => {
  const dx = getSwipeTranslate(id)
  return Math.max(0, 1 - dx / 200)
}

const onPointerUp = (id: string, activity: AgentActivity) => {
  const s = swipeState[id]
  if (!s) return
  const dx = s.currentX - s.startX
  if (dx > 100) {
    dismissAgentActivity(id)
  } else if (!s.swiping) {
    navigateToTask(activity)
  }
  delete swipeState[id]
}

onMounted(() => {
  relativeTick = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (relativeTick) {
    clearInterval(relativeTick)
    relativeTick = null
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed right-5 top-5 z-50 flex w-[440px] flex-col gap-2.5"
      @mouseenter="containerHovered = true"
      @mouseleave="containerHovered = false"
    >
      <TransitionGroup
        enter-active-class="toast-enter-active"
        enter-from-class="toast-enter-from"
        enter-to-class="toast-enter-to"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-full"
        move-class="transition-all duration-300 ease-out"
      >
        <article
          v-for="activity in agentActivities"
          :key="activity.id"
          role="alert"
          tabindex="0"
          class="group pointer-events-auto relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#161619] shadow-lg dark:shadow-black/50 hover:-translate-y-0.5 hover:shadow-xl dark:hover:shadow-black/60 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-white/[0.16] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#050506] select-none touch-none"
          :class="{ 'transition-all duration-200': !swipeState[activity.id]?.swiping }"
          :style="{
            transform: `translateX(${getSwipeTranslate(activity.id)}px)`,
            opacity: getSwipeOpacity(activity.id),
          }"
          @pointerdown="onPointerDown(activity.id, $event)"
          @pointermove="onPointerMove(activity.id, $event)"
          @pointerup="onPointerUp(activity.id, activity)"
          @pointercancel="delete swipeState[activity.id]"
          @keydown.enter.prevent="navigateToTask(activity)"
          @keydown.space.prevent="navigateToTask(activity)"
        >
          <div class="p-3">
            <div class="flex items-start gap-3">
              <div
                class="h-9 w-9 flex-shrink-0 rounded-full inline-flex items-center justify-center ring-1 ring-black/5 dark:ring-white/10"
                :style="{
                  backgroundColor: `${providerPalette(activity.agent.provider).accent}1A`,
                  color: providerPalette(activity.agent.provider).accent,
                }"
              >
                <span class="text-xs font-semibold tracking-wide">
                  {{ activity.agent.name?.charAt(0)?.toUpperCase() || 'A' }}
                </span>
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {{ activity.agent.name }}
                    </p>
                    <div class="mt-0.5 flex items-center gap-1.5">
                      <p class="truncate text-[11px] font-medium text-slate-500 dark:text-zinc-400">
                        {{ buildPathLabel(activity) }}
                      </p>
                      <span
                        class="h-1 w-1 flex-shrink-0 rounded-full"
                        :style="{ backgroundColor: providerPalette(activity.agent.provider).accent }"
                      />
                      <span class="text-[11px] text-slate-400 dark:text-zinc-500">
                        {{ providerPalette(activity.agent.provider).label }}
                      </span>
                    </div>
                  </div>

                  <div class="flex flex-shrink-0 items-center gap-1.5 pl-1">
                    <span class="text-[11px] font-medium text-slate-400 dark:text-zinc-500">
                      {{ formatRelativeTime(activity.timestamp, activity.receivedAt) }}
                    </span>
                    <button
                      class="inline-flex h-5 w-5 items-center justify-center rounded-md leading-none text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.08] dark:hover:text-zinc-300"
                      aria-label="Dismiss agent activity notification"
                      @click.stop="dismissAgentActivity(activity.id)"
                    >
                      <Icon name="heroicons:x-mark" class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p class="mt-2 text-sm font-medium text-slate-700 dark:text-zinc-200 activity-line-clamp">
                  {{ buildActivityLabel(activity) }}
                </p>
              </div>
            </div>
          </div>
        </article>
      </TransitionGroup>

      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <button
          v-if="containerHovered && agentActivities.length > 1"
          class="pointer-events-auto mx-auto mt-1 rounded-lg px-3 py-1 text-xs font-medium text-slate-400 dark:text-zinc-500 transition-colors hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          @click="clearAllAgentActivities()"
        >
          Clear all
        </button>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-from {
  opacity: 0;
  transform: translateX(120%) scale(0.95);
}

.toast-enter-to {
  opacity: 1;
  transform: translateX(0) scale(1);
}

.toast-enter-active {
  animation: toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes toast-slide-in {
  0% {
    opacity: 0;
    transform: translateX(120%) scale(0.95);
  }
  60% {
    opacity: 1;
    transform: translateX(-8px) scale(1.01);
  }
  100% {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

.activity-line-clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
</style>
