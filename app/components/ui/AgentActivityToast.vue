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
  notifications,
  agentActivities,
  dismissAgentActivity,
  pauseAgentActivityDismiss,
  resumeAgentActivityDismiss,
} = useWebSocket()

const toastTopOffset = computed(() => {
  const chatToastCount = Math.min(notifications.value.length, 5)
  if (chatToastCount === 0) return 80
  return 20 + (chatToastCount * 92)
})

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
  if (activity.project?.title) {
    return `${activity.project.title} > ${activity.task.title}`
  }
  return activity.task.title
}

const formatRelativeTime = (timestamp?: string, fallbackMs?: number) => {
  const parsed = timestamp ? Date.parse(timestamp) : NaN
  const referenceMs = Number.isFinite(parsed) ? parsed : (fallbackMs || now.value)
  const deltaSec = Math.max(0, Math.floor((now.value - referenceMs) / 1000))
  if (deltaSec < 60) return `${deltaSec}s`
  if (deltaSec < 3600) return `${Math.floor(deltaSec / 60)}m`
  if (deltaSec < 86400) return `${Math.floor(deltaSec / 3600)}h`
  return `${Math.floor(deltaSec / 86400)}d`
}

const navigateToTask = async (activity: AgentActivity) => {
  dismissAgentActivity(activity.id)
  if (!activity.project?.id) return
  await router.push(`/workspace/projects/${activity.project.id}?task=${activity.task.id}`)
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
      class="pointer-events-none fixed right-4 z-50 flex w-80 flex-col gap-3"
      :style="{ top: `${toastTopOffset}px` }"
    >
      <TransitionGroup
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 translate-x-8"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="opacity-0 translate-x-8"
      >
        <article
          v-for="activity in agentActivities"
          :key="activity.id"
          role="alert"
          tabindex="0"
          class="group pointer-events-auto relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/[0.06] dark:bg-dm-card shadow-lg dark:shadow-black/50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl dark:hover:shadow-black/60 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-white/[0.16] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-[#050506]"
          @click="navigateToTask(activity)"
          @mouseenter="pauseAgentActivityDismiss(activity.id)"
          @mouseleave="resumeAgentActivityDismiss(activity.id)"
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
    </div>
  </Teleport>
</template>

<style scoped>
.activity-line-clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
</style>
