<script setup lang="ts">
interface CompletionItem {
  id: string
  title: string
  completedAt: string
  timeWorked: number // in minutes
  isOwner: boolean
}

interface HeatmapDay {
  date: string
  count: number
  intensity: number // 0-4
  completions: CompletionItem[]
}

const props = defineProps<{
  workspaceId: string | null
  userId: string
  projectId?: string | null
  days?: number
}>()

const canFetch = computed(() => !!props.workspaceId && !!props.userId)

const { data: completionData, refresh } = useFetch('/api/focus/user-completions', {
  query: computed(() => ({
    workspaceId: props.workspaceId ?? undefined,
    userId: props.userId,
    projectId: props.projectId || undefined,
    days: props.days ?? 14,
  })),
  immediate: false,
})

watch(
  () => [props.workspaceId, props.userId, props.projectId, props.days],
  () => {
    if (canFetch.value) refresh()
  },
  { immediate: true }
)

const intensityColors = [
  'bg-slate-100 dark:bg-white/[0.08]',
  'bg-emerald-200 dark:bg-emerald-500/20',
  'bg-emerald-300 dark:bg-emerald-500/40',
  'bg-emerald-400 dark:bg-emerald-500/60',
  'bg-emerald-500 dark:bg-emerald-400',
]

const getColor = (intensity: number) => intensityColors[Math.min(intensity, 4)]

const formatTimeWorked = (minutes: number): string => {
  if (minutes < 1) return 'just started'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

const hoveredDay = ref<HeatmapDay | null>(null)
const hoverPosition = ref({ x: 0, y: 0 })
const showBelow = ref(false)
const heatmapRef = ref<HTMLElement | null>(null)

const handleMouseEnter = (day: HeatmapDay, event: MouseEvent) => {
  if (day.count === 0) return
  hoveredDay.value = day
  updatePosition(event)
}

const handleMouseMove = (event: MouseEvent) => {
  updatePosition(event)
}

const handleMouseLeave = () => {
  hoveredDay.value = null
}

const updatePosition = (event: MouseEvent) => {
  if (!heatmapRef.value) return
  const rect = heatmapRef.value.getBoundingClientRect()
  const tooltipHeight = 200
  showBelow.value = event.clientY < tooltipHeight

  hoverPosition.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top + (showBelow.value ? 20 : -10),
  }
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div ref="heatmapRef" class="relative">
    <div class="flex items-center gap-0.5">
      <template v-if="completionData?.heatmap">
        <div
          v-for="day in completionData.heatmap"
          :key="day.date"
          :class="[
            'w-3 h-3 rounded-sm transition-colors cursor-default',
            getColor(day.intensity),
            day.count > 0 ? 'hover:ring-2 hover:ring-emerald-400/50' : ''
          ]"
          @mouseenter="handleMouseEnter(day, $event)"
          @mousemove="handleMouseMove"
          @mouseleave="handleMouseLeave"
        />
      </template>
      <template v-else>
        <div
          v-for="i in (props.days ?? 14)"
          :key="i"
          class="w-3 h-3 rounded-sm bg-slate-100 dark:bg-white/[0.08] animate-pulse"
        />
      </template>
    </div>

    <div class="flex items-center justify-between mt-1.5 text-xs text-slate-400 dark:text-zinc-500">
      <span>{{ completionData?.totalCompletions ?? 0 }} completed</span>
      <span>{{ props.days ?? 14 }} days</span>
    </div>

    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="hoveredDay && heatmapRef"
          class="fixed z-50 pointer-events-none"
          :style="{
            left: `${heatmapRef.getBoundingClientRect().left + hoverPosition.x}px`,
            top: `${heatmapRef.getBoundingClientRect().top + hoverPosition.y}px`,
            transform: showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
          }"
        >
          <div class="bg-slate-900 text-white rounded-lg shadow-xl px-3 py-2 max-w-xs relative">
            <div class="text-xs font-medium text-slate-300 mb-1.5 pb-1.5 border-b border-slate-700">
              {{ formatDate(hoveredDay.date) }}
              <span class="text-emerald-400 ml-1">{{ hoveredDay.count }} completed</span>
            </div>

            <div class="space-y-1.5 max-h-48 overflow-y-auto">
              <div
                v-for="completion in hoveredDay.completions"
                :key="completion.id"
                class="flex items-start gap-2"
              >
                <Icon name="heroicons:check-circle" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-white truncate flex items-center gap-1">
                    <Icon
                      v-if="completion.isOwner"
                      name="heroicons:star"
                      class="w-3 h-3 text-amber-300 flex-shrink-0"
                    />
                    <span class="truncate">{{ completion.title }}</span>
                  </div>
                  <div class="text-xs text-slate-400">
                    {{ formatTimeWorked(completion.timeWorked) }} worked
                  </div>
                </div>
              </div>
            </div>

            <div
              v-if="showBelow"
              class="absolute left-1/2 -top-1.5 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45"
            />
            <div
              v-else
              class="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45"
            />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
