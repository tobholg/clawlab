<script setup lang="ts">
interface ActivityDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  completions: Array<{ id: string; title: string }>
}

const props = defineProps<{
  data: ActivityDay[]
  weeks?: number
}>()

const weeks = computed(() => props.weeks || 16)

// Generate grid data (weeks x 7 days)
const grid = computed(() => {
  const result: ActivityDay[][] = []
  const dataMap = new Map(props.data.map(d => [d.date, d]))

  const today = new Date()
  today.setHours(12, 0, 0, 0) // Normalize to midday to avoid timezone issues
  
  // Calculate end date (today, aligned to end of week = Saturday)
  const endDate = new Date(today)
  const daysUntilSaturday = (6 - endDate.getDay() + 7) % 7
  endDate.setDate(endDate.getDate() + daysUntilSaturday)
  
  // Calculate start date (weeks ago, aligned to Sunday)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (weeks.value * 7) + 1)

  let currentWeek: ActivityDay[] = []
  const currentDate = new Date(startDate)

  while (currentDate <= endDate) {
    // Use local date string to avoid timezone issues
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const day = String(currentDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    const activity = dataMap.get(dateStr) || {
      date: dateStr,
      count: 0,
      level: 0 as const,
      completions: [],
    }

    currentWeek.push(activity)

    if (currentWeek.length === 7) {
      result.push(currentWeek)
      currentWeek = []
    }
    
    currentDate.setDate(currentDate.getDate() + 1)
  }

  if (currentWeek.length > 0) {
    result.push(currentWeek)
  }

  return result
})

// Get month labels
const months = computed(() => {
  const result: { label: string; offset: number }[] = []
  let lastMonth = -1

  grid.value.forEach((week, weekIndex) => {
    const firstDay = new Date(week[0].date)
    const month = firstDay.getMonth()

    if (month !== lastMonth) {
      result.push({
        label: firstDay.toLocaleDateString('en', { month: 'short' }),
        offset: weekIndex,
      })
      lastMonth = month
    }
  })

  return result
})

// Total completions
const totalCompletions = computed(() => 
  props.data.reduce((sum, d) => sum + d.count, 0)
)

// Intensity to color mapping (blue theme - same as workspace)
const levelColors = [
  'bg-slate-100 dark:bg-white/[0.06]',      // 0 - no activity
  'bg-blue-200 dark:bg-blue-500/30',         // 1 - light
  'bg-blue-300 dark:bg-blue-500/50',         // 2 - medium
  'bg-blue-400 dark:bg-blue-400/70',         // 3 - high
  'bg-blue-500 dark:bg-blue-400',            // 4 - very high
]

const getColor = (level: number) => levelColors[Math.min(level, 4)]

// Hovering state
const hoveredDay = ref<ActivityDay | null>(null)
const tooltipRef = ref<HTMLElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })

const handleMouseEnter = (day: ActivityDay, event: MouseEvent) => {
  hoveredDay.value = day
  updateTooltipPosition(event)
}

const handleMouseMove = (event: MouseEvent) => {
  updateTooltipPosition(event)
}

const handleMouseLeave = () => {
  hoveredDay.value = null
}

const updateTooltipPosition = (event: MouseEvent) => {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  tooltipPosition.value = {
    x: event.clientX,
    y: event.clientY - 10,
  }
}

// Format date for display
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div ref="containerRef" class="bg-white dark:bg-dm-card rounded-2xl border border-slate-100 dark:border-white/[0.06] p-6 shadow-sm dark:shadow-none h-full">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-5">
      <div class="w-10 h-10 bg-violet-100 dark:bg-violet-500/10 rounded-xl flex items-center justify-center">
        <Icon name="heroicons:fire" class="w-5 h-5 text-violet-600 dark:text-violet-400" />
      </div>
      <div>
        <h3 class="text-sm font-semibold text-slate-900 dark:text-zinc-100">Project Activity</h3>
        <p class="text-xs text-slate-500 dark:text-zinc-500">{{ totalCompletions }} items completed in the last {{ weeks }} weeks</p>
      </div>
    </div>

    <!-- Month labels -->
    <div class="relative mb-2 ml-8 h-4 overflow-hidden">
      <div class="flex absolute">
        <template v-for="(month, idx) in months" :key="month.label + month.offset">
          <div 
            class="text-[10px] text-slate-400 dark:text-zinc-500 font-medium"
            :style="{ 
              marginLeft: idx === 0 ? '0' : `${(month.offset - (months[idx - 1]?.offset || 0)) * 14 - 24}px`,
              minWidth: '24px'
            }"
          >
            {{ month.label }}
          </div>
        </template>
      </div>
    </div>

    <!-- Grid wrapper for scrolling on mobile -->
    <div class="overflow-x-auto -mx-2 px-2">
      <div class="flex gap-[3px] min-w-max">
        <!-- Day labels (Sun-Sat abbreviated) -->
        <div class="flex flex-col gap-[3px] mr-1 pt-px">
          <div class="h-[11px] text-[9px] text-slate-400 dark:text-zinc-600 leading-[11px]"></div>
          <div class="h-[11px] text-[9px] text-slate-400 dark:text-zinc-600 leading-[11px]">M</div>
          <div class="h-[11px] text-[9px] text-slate-400 dark:text-zinc-600 leading-[11px]"></div>
          <div class="h-[11px] text-[9px] text-slate-400 dark:text-zinc-600 leading-[11px]">W</div>
          <div class="h-[11px] text-[9px] text-slate-400 dark:text-zinc-600 leading-[11px]"></div>
          <div class="h-[11px] text-[9px] text-slate-400 dark:text-zinc-600 leading-[11px]">F</div>
          <div class="h-[11px] text-[9px] text-slate-400 dark:text-zinc-600 leading-[11px]"></div>
        </div>

        <!-- Weeks -->
        <div class="flex gap-[3px]">
          <div 
            v-for="(week, weekIndex) in grid" 
            :key="weekIndex"
            class="flex flex-col gap-[3px]"
          >
            <div
              v-for="day in week"
              :key="day.date"
              :class="[
                'w-[11px] h-[11px] rounded-sm transition-all duration-150 cursor-default',
                getColor(day.level),
                day.count > 0 ? 'hover:ring-2 hover:ring-violet-400/50 hover:scale-110' : '',
              ]"
              @mouseenter="handleMouseEnter(day, $event)"
              @mousemove="handleMouseMove"
              @mouseleave="handleMouseLeave"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center justify-end gap-2 mt-4 text-[10px] text-slate-400 dark:text-zinc-500">
      <span>Less</span>
      <div class="flex gap-[3px]">
        <div v-for="i in 5" :key="i" :class="['w-[11px] h-[11px] rounded-sm', levelColors[i - 1]]" />
      </div>
      <span>More</span>
    </div>

    <!-- Tooltip -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-150 ease-out"
        leave-active-class="transition-all duration-100 ease-in"
        enter-from-class="opacity-0 scale-95"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="hoveredDay"
          ref="tooltipRef"
          class="fixed z-50 pointer-events-none"
          :style="{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)'
          }"
        >
          <div class="bg-slate-900 text-white rounded-xl shadow-2xl px-4 py-3 min-w-[180px] relative">
            <!-- Date header -->
            <div class="text-xs font-medium text-slate-300 mb-2 pb-2 border-b border-slate-700/50">
              {{ formatDate(hoveredDay.date) }}
            </div>

            <div v-if="hoveredDay.count === 0" class="text-sm text-slate-400">
              No completions
            </div>
            
            <div v-else>
              <div class="flex items-center gap-2 mb-2">
                <Icon name="heroicons:check-circle" class="w-4 h-4 text-violet-400" />
                <span class="text-sm font-semibold text-white">
                  {{ hoveredDay.count }} item{{ hoveredDay.count > 1 ? 's' : '' }} completed
                </span>
              </div>
              
              <!-- Completions list -->
              <div v-if="hoveredDay.completions.length > 0" class="space-y-1 mt-2">
                <div
                  v-for="completion in hoveredDay.completions.slice(0, 5)"
                  :key="completion.id"
                  class="text-xs text-slate-300 truncate pl-6"
                >
                  • {{ completion.title }}
                </div>
                <div v-if="hoveredDay.completions.length > 5" class="text-xs text-slate-500 pl-6">
                  +{{ hoveredDay.completions.length - 5 }} more
                </div>
              </div>
            </div>
            
            <!-- Arrow pointing down -->
            <div class="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
