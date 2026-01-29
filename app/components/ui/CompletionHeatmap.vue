<script setup lang="ts">
interface CompletionItem {
  id: string
  title: string
  completedAt: string
  timeWorked: number // in minutes
}

interface HeatmapDay {
  date: string
  count: number
  intensity: number // 0-4
  completions: CompletionItem[]
}

const props = defineProps<{
  itemId: string
  days?: number
}>()

const { data: completionData } = useFetch(`/api/items/${props.itemId}/completions`, {
  query: { days: props.days ?? 14 },
  lazy: true,
})

// Intensity to color mapping (using emerald/green for completions)
const intensityColors = [
  'bg-slate-100',      // 0 - no completions
  'bg-emerald-200',    // 1 - 1 completion
  'bg-emerald-300',    // 2 - 2 completions
  'bg-emerald-400',    // 3 - 3 completions
  'bg-emerald-500',    // 4+ - many completions
]

const getColor = (intensity: number) => intensityColors[Math.min(intensity, 4)]

// Format time worked
const formatTimeWorked = (minutes: number): string => {
  if (minutes < 1) return 'just started'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

// Hovering state
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

  // Check if tooltip would go off screen at top (estimate ~200px for tooltip height)
  const tooltipHeight = 200
  showBelow.value = event.clientY < tooltipHeight

  hoverPosition.value = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top + (showBelow.value ? 20 : -10),
  }
}

// Format date for display
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div ref="heatmapRef" class="relative">
    <!-- Heatmap row -->
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
        <!-- Skeleton loading -->
        <div
          v-for="i in (days ?? 14)"
          :key="i"
          class="w-3 h-3 rounded-sm bg-slate-100 animate-pulse"
        />
      </template>
    </div>

    <!-- Summary text -->
    <div class="flex items-center justify-between mt-1.5 text-xs text-slate-400">
      <span>{{ completionData?.totalCompletions ?? 0 }} completed</span>
      <span>{{ days ?? 14 }} days</span>
    </div>

    <!-- Tooltip popover -->
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
            <!-- Date header -->
            <div class="text-xs font-medium text-slate-300 mb-1.5 pb-1.5 border-b border-slate-700">
              {{ formatDate(hoveredDay.date) }}
              <span class="text-emerald-400 ml-1">{{ hoveredDay.count }} completed</span>
            </div>

            <!-- Completions list -->
            <div class="space-y-1.5 max-h-48 overflow-y-auto">
              <div
                v-for="completion in hoveredDay.completions"
                :key="completion.id"
                class="flex items-start gap-2"
              >
                <Icon name="heroicons:check-circle" class="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div class="min-w-0 flex-1">
                  <div class="text-sm text-white truncate">{{ completion.title }}</div>
                  <div class="text-xs text-slate-400">
                    {{ formatTimeWorked(completion.timeWorked) }} worked
                  </div>
                </div>
              </div>
            </div>

            <!-- Arrow (top or bottom depending on position) -->
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
