<script setup lang="ts">
import type { Item, EstimationMetrics } from '~/types'
import { calculateEstimatedCompletion, STATUS_CONFIG } from '~/types'

const props = defineProps<{
  tasks: (Item & { children?: Item[] })[]
}>()

const emit = defineEmits<{
  taskClick: [task: Item]
}>()

// Zoom levels
type ZoomLevel = 'days' | 'weeks' | 'months'
const zoomLevel = ref<ZoomLevel>('weeks')

// Expanded tasks state
const expandedTasks = ref<Set<string>>(new Set())

function toggleExpand(taskId: string, event: Event) {
  event.stopPropagation()
  if (expandedTasks.value.has(taskId)) {
    expandedTasks.value.delete(taskId)
  } else {
    expandedTasks.value.add(taskId)
  }
  // Trigger reactivity
  expandedTasks.value = new Set(expandedTasks.value)
}

// Extended task with computed metrics
interface TaskWithMetrics extends Item {
  metrics: EstimationMetrics
  children?: (Item & { metrics: EstimationMetrics })[]
  isSubtask?: boolean
  parentId?: string | null
}

// Filter to tasks with some progress or start date, add metrics
const activeTasks = computed<TaskWithMetrics[]>(() => {
  const result: TaskWithMetrics[] = []
  
  props.tasks
    .filter(t => t.status !== 'done')
    .map(t => ({
      ...t,
      metrics: calculateEstimatedCompletion(t),
      children: t.children?.map(c => ({
        ...c,
        metrics: calculateEstimatedCompletion(c)
      }))
    }))
    .filter(t => t.metrics.startDate || t.progress > 0)
    .sort((a, b) => {
      const aStart = a.metrics.startDate?.getTime() || 0
      const bStart = b.metrics.startDate?.getTime() || 0
      if (aStart !== bStart) return aStart - bStart
      return (a.metrics.estimatedCompletionDate?.getTime() || 0) - (b.metrics.estimatedCompletionDate?.getTime() || 0)
    })
    .forEach(task => {
      result.push(task)
      
      // If expanded and has children, add them
      if (expandedTasks.value.has(task.id) && task.children?.length) {
        task.children
          .filter(c => c.status !== 'done' && (c.metrics.startDate || c.progress > 0))
          .forEach(child => {
            result.push({
              ...child,
              isSubtask: true,
              parentId: task.id
            } as TaskWithMetrics)
          })
      }
    })
  
  return result
})

// Get parent tasks (for checking if has children)
const parentTasks = computed(() => {
  return new Map(
    props.tasks
      .filter(t => t.children && t.children.length > 0)
      .map(t => [t.id, t.children!.length])
  )
})

// Timeline bounds
const today = new Date()
today.setHours(0, 0, 0, 0)

const timelineStart = computed(() => {
  const earliestStart = activeTasks.value.reduce((min, t) => {
    const start = t.metrics.startDate
    return start && start < min ? start : min
  }, new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000))
  
  const start = new Date(earliestStart)
  start.setDate(start.getDate() - 7)
  return start
})

const timelineEnd = computed(() => {
  const latestDate = activeTasks.value.reduce((max, t) => {
    const dates = [
      t.metrics.latestCompletionDate,
      t.metrics.dueDate
    ].filter(Boolean) as Date[]
    
    const taskMax = dates.reduce((m, d) => d > m ? d : m, max)
    return taskMax
  }, new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000))
  
  const end = new Date(latestDate)
  end.setDate(end.getDate() + 14)
  return end
})

const totalDays = computed(() => 
  Math.ceil((timelineEnd.value.getTime() - timelineStart.value.getTime()) / (24 * 60 * 60 * 1000))
)

// Pixels per day based on zoom
const dayWidth = computed(() => {
  switch (zoomLevel.value) {
    case 'days': return 40
    case 'weeks': return 16
    case 'months': return 4
    default: return 16
  }
})

const timelineWidth = computed(() => totalDays.value * dayWidth.value)

// Day markers for grid
const dayMarkers = computed(() => {
  const markers = []
  const current = new Date(timelineStart.value)
  
  while (current <= timelineEnd.value) {
    markers.push({
      date: new Date(current),
      isToday: current.toDateString() === today.toDateString(),
      isWeekStart: current.getDay() === 1,
      isMonthStart: current.getDate() === 1,
      dayOfWeek: current.getDay(),
    })
    current.setDate(current.getDate() + 1)
  }
  
  return markers
})

// Header labels based on zoom
const headerLabels = computed(() => {
  const labels: { date: Date; label: string; position: number }[] = []
  
  if (zoomLevel.value === 'days') {
    dayMarkers.value.forEach((day, i) => {
      labels.push({
        date: day.date,
        label: day.date.toLocaleDateString('en', { weekday: 'short', day: 'numeric' }),
        position: i * dayWidth.value
      })
    })
  } else if (zoomLevel.value === 'weeks') {
    dayMarkers.value.forEach((day, i) => {
      if (day.isWeekStart || i === 0) {
        labels.push({
          date: day.date,
          label: day.date.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
          position: i * dayWidth.value
        })
      }
    })
  } else {
    dayMarkers.value.forEach((day, i) => {
      if (day.isMonthStart || i === 0) {
        labels.push({
          date: day.date,
          label: day.date.toLocaleDateString('en', { month: 'long', year: 'numeric' }),
          position: i * dayWidth.value
        })
      }
    })
  }
  
  return labels
})

// Convert date to pixel position
function dateToPosition(date: Date): number {
  const days = (date.getTime() - timelineStart.value.getTime()) / (24 * 60 * 60 * 1000)
  return days * dayWidth.value
}

// Get task bar styles and segments
function getTaskBarData(task: TaskWithMetrics) {
  const { metrics } = task
  
  const startPos = metrics.startDate ? dateToPosition(metrics.startDate) : dateToPosition(today)
  const endPos = metrics.latestCompletionDate ? dateToPosition(metrics.latestCompletionDate) : startPos + 50
  const width = Math.max(endPos - startPos, 20)
  
  const progressWidth = (task.progress / 100) * width
  
  const expectedPos = metrics.estimatedCompletionDate ? dateToPosition(metrics.estimatedCompletionDate) : endPos
  
  const certainWidth = Math.max(0, expectedPos - startPos)
  const fadeWidth = Math.max(0, endPos - expectedPos)
  
  let dueDateOffset = null
  let overdueStart = null
  let overdueWidth = 0
  
  if (metrics.dueDate) {
    dueDateOffset = dateToPosition(metrics.dueDate) - startPos
    
    if (metrics.isOverdue && expectedPos > dateToPosition(metrics.dueDate)) {
      overdueStart = dueDateOffset
      overdueWidth = endPos - dateToPosition(metrics.dueDate) // extend to full uncertainty range
    }
  }
  
  return {
    left: startPos,
    width,
    progressWidth,
    certainWidth,
    fadeWidth,
    dueDateOffset,
    overdueStart,
    overdueWidth,
    isOverdue: metrics.isOverdue,
  }
}

// Status colors
const statusBarColors: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  blocked: 'bg-rose-500',
  paused: 'bg-amber-500',
  done: 'bg-emerald-500',
}

// Scroll refs for sync
const headerScrollRef = ref<HTMLElement | null>(null)
const bodyScrollRef = ref<HTMLElement | null>(null)
const timelineScrollRef = ref<HTMLElement | null>(null)

// Sync horizontal scroll between header and timeline
function handleTimelineScroll(event: Event) {
  const target = event.target as HTMLElement
  if (headerScrollRef.value) {
    headerScrollRef.value.scrollLeft = target.scrollLeft
  }
}

function handleBodyScroll(event: Event) {
  // Body scroll handles vertical sync automatically since tasks column is inside
}

// Hover state
const hoveredTask = ref<TaskWithMetrics | null>(null)
const hoverPosition = ref({ x: 0, y: 0 })

function handleMouseEnter(task: TaskWithMetrics, event: MouseEvent) {
  hoveredTask.value = task
  updateHoverPosition(event)
}

function handleMouseMove(event: MouseEvent) {
  if (hoveredTask.value) {
    updateHoverPosition(event)
  }
}

function handleMouseLeave() {
  hoveredTask.value = null
}

function updateHoverPosition(event: MouseEvent) {
  const container = (event.currentTarget as HTMLElement).closest('.timeline-scroll-container')
  if (container) {
    const rect = container.getBoundingClientRect()
    hoverPosition.value = {
      x: event.clientX - rect.left + 10,
      y: event.clientY - rect.top + 10
    }
  }
}

// Format date for display
function formatDate(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Format relative days
function formatDays(days: number): string {
  if (days < 1) return 'Today'
  if (days === 1) return '1 day'
  if (days < 7) return `${Math.round(days)} days`
  const weeks = days / 7
  if (weeks < 4) return `${Math.round(weeks)} weeks`
  return `${Math.round(days / 30)} months`
}
</script>

<template>
  <div class="timeline-container bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
    <!-- Header with zoom controls -->
    <div class="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
      <h3 class="text-sm font-semibold text-gray-700">Timeline</h3>
      <div class="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
        <button
          v-for="level in ['days', 'weeks', 'months'] as const"
          :key="level"
          class="px-3 py-1 text-xs font-medium rounded-md transition-colors"
          :class="zoomLevel === level 
            ? 'bg-white text-gray-900 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'"
          @click="zoomLevel = level"
        >
          {{ level.charAt(0).toUpperCase() + level.slice(1) }}
        </button>
      </div>
    </div>

    <!-- Timeline body -->
    <div class="flex flex-col flex-1 min-h-0 overflow-hidden">
      <!-- Fixed headers row -->
      <div class="flex flex-shrink-0">
        <!-- Tasks column header -->
        <div class="w-56 flex-shrink-0 h-12 border-b border-r border-gray-200 bg-gray-50 px-3 flex items-center z-20">
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks</span>
        </div>
        
        <!-- Timeline header (scrolls horizontally with content) -->
        <div 
          ref="headerScrollRef"
          class="flex-1 overflow-x-auto scrollbar-hide"
        >
          <div 
            class="h-12 border-b border-gray-200 bg-gray-50 relative"
            :style="{ width: `${timelineWidth}px`, minWidth: '100%' }"
          >
            <!-- Date labels -->
            <div class="absolute inset-0">
              <div
                v-for="label in headerLabels"
                :key="label.date.toISOString()"
                class="absolute top-0 h-full flex items-center text-xs font-medium text-gray-600 border-l border-gray-200 px-2"
                :style="{ left: `${label.position}px` }"
              >
                {{ label.label }}
              </div>
            </div>
            
            <!-- Today marker -->
            <div
              class="absolute top-0 h-full w-0.5 bg-relai-500 z-20"
              :style="{ left: `${dateToPosition(today)}px` }"
            >
              <span class="absolute -top-0 left-1/2 -translate-x-1/2 text-[10px] font-bold text-relai-600 bg-relai-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                TODAY
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Scrollable body (tasks + timeline scroll together vertically) -->
      <div 
        ref="bodyScrollRef"
        class="flex flex-1 min-h-0 overflow-y-auto"
        @scroll="handleBodyScroll"
      >
        <!-- Sticky task names column -->
        <div class="w-56 flex-shrink-0 bg-white border-r border-gray-200 sticky left-0 z-10">
          <div
            v-for="task in activeTasks"
            :key="task.id + '-label'"
            class="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
            :class="task.isSubtask ? 'h-10 bg-gray-50/50' : 'h-14'"
            @click="emit('taskClick', task)"
          >
            <div 
              class="h-full flex items-center gap-2"
              :class="task.isSubtask ? 'pl-8 pr-3' : 'px-3'"
            >
              <!-- Expand/collapse button for parent tasks -->
              <button
                v-if="!task.isSubtask && parentTasks.has(task.id)"
                class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 transition-colors"
                @click="toggleExpand(task.id, $event)"
              >
                <Icon 
                  name="heroicons:chevron-right" 
                  class="w-3.5 h-3.5 text-gray-400 transition-transform duration-200"
                  :class="expandedTasks.has(task.id) ? 'rotate-90' : ''"
                />
              </button>
              <!-- Spacer for tasks without children -->
              <div v-else-if="!task.isSubtask" class="w-5 flex-shrink-0" />
              
              <!-- Subtask connector line -->
              <div v-if="task.isSubtask" class="flex-shrink-0 w-3 h-full relative">
                <div class="absolute left-0 top-0 bottom-1/2 w-px bg-gray-200" />
                <div class="absolute left-0 top-1/2 w-3 h-px bg-gray-200" />
              </div>
              
              <!-- Task info -->
              <div class="flex-1 min-w-0">
                <div 
                  class="font-medium text-gray-900 truncate"
                  :class="task.isSubtask ? 'text-xs' : 'text-sm'"
                >
                  {{ task.title }}
                </div>
                <div 
                  v-if="!task.isSubtask"
                  class="flex items-center gap-2 text-xs text-gray-500"
                >
                  <span 
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                    :class="STATUS_CONFIG[task.status].color"
                  >
                    {{ STATUS_CONFIG[task.status].label }}
                  </span>
                  <span>{{ task.progress }}%</span>
                  <span 
                    v-if="task.confidence < 70"
                    class="text-amber-500"
                    :title="`${task.confidence}% confidence`"
                  >
                    ⚠️
                  </span>
                  <span 
                    v-if="parentTasks.has(task.id)"
                    class="text-gray-400"
                  >
                    · {{ parentTasks.get(task.id) }} subtasks
                  </span>
                </div>
                <!-- Compact subtask meta -->
                <div 
                  v-else
                  class="flex items-center gap-1.5 text-[10px] text-gray-400"
                >
                  <span>{{ task.progress }}%</span>
                  <span 
                    v-if="task.confidence < 70"
                    class="text-amber-500"
                  >⚠️</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div 
            v-if="activeTasks.length === 0"
            class="h-32 flex items-center justify-center text-gray-400 text-sm"
          >
            No active tasks
          </div>
        </div>

        <!-- Scrollable timeline area (horizontal only here, vertical shared with tasks) -->
        <div 
          ref="timelineScrollRef"
          class="flex-1 overflow-x-auto timeline-scroll-container relative"
          @scroll="handleTimelineScroll"
        >
          <div :style="{ width: `${timelineWidth}px`, minWidth: '100%' }">
            <!-- Task rows with bars -->
            <div class="relative">
              <!-- Grid lines -->
              <div class="absolute inset-0 pointer-events-none">
                <div
                  v-for="(day, index) in dayMarkers"
                  :key="'grid-' + index"
                  class="absolute top-0 h-full border-l"
                  :class="[
                    day.isToday ? 'border-relai-200 border-l-2' :
                    day.isMonthStart ? 'border-gray-200' :
                    day.isWeekStart ? 'border-gray-100' : 
                    'border-gray-50'
                  ]"
                  :style="{ left: `${index * dayWidth}px` }"
                />
              </div>

              <!-- Task bars -->
              <div
                v-for="task in activeTasks"
                :key="task.id + '-bar'"
                class="relative border-b border-gray-100 flex items-center"
                :class="task.isSubtask ? 'h-10 bg-gray-50/30' : 'h-14'"
              >
                <div
                  class="absolute group cursor-pointer"
                  :class="task.isSubtask ? 'h-5' : 'h-8'"
                  :style="{
                    left: `${getTaskBarData(task).left}px`,
                    width: `${getTaskBarData(task).width}px`
                  }"
                  @mouseenter="handleMouseEnter(task, $event)"
                  @mousemove="handleMouseMove"
                  @mouseleave="handleMouseLeave"
                  @click="emit('taskClick', task)"
                >
                  <!-- Base bar (uncertainty range) -->
                  <div 
                    class="absolute inset-0 bg-gray-100 border border-gray-200 overflow-hidden"
                    :class="task.isSubtask ? 'rounded' : 'rounded-lg'"
                  >
                    <!-- Solid progress portion -->
                    <div
                      class="absolute inset-y-0 left-0 transition-all"
                      :class="[
                        statusBarColors[task.status],
                        task.isSubtask ? 'rounded-l' : 'rounded-l-lg'
                      ]"
                      :style="{ width: `${getTaskBarData(task).progressWidth}px`, opacity: task.isSubtask ? 0.7 : 0.85 }"
                    />
                    
                    <!-- Remaining certain portion (expected completion) marker -->
                    <div
                      class="absolute inset-y-0 left-0 border-r-2 border-gray-400"
                      :style="{ width: `${getTaskBarData(task).certainWidth}px` }"
                    />
                    
                    <!-- Uncertainty fade zone (only when NOT overdue) - fades to transparent -->
                    <div
                      v-if="getTaskBarData(task).fadeWidth > 0 && !getTaskBarData(task).isOverdue"
                      class="absolute inset-y-0 right-0 rounded-r-lg"
                      :style="{
                        width: `${getTaskBarData(task).fadeWidth}px`,
                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.95))'
                      }"
                    />
                    
                    <!-- Overdue warning zone - orange tint fading to transparent -->
                    <div
                      v-if="getTaskBarData(task).overdueWidth > 0"
                      class="absolute inset-y-0 rounded-r-lg"
                      :style="{
                        left: `${getTaskBarData(task).overdueStart}px`,
                        right: '0',
                        background: 'linear-gradient(to right, rgba(251, 146, 60, 0.45), transparent)'
                      }"
                    />
                    <!-- White fade overlay for overdue uncertainty -->
                    <div
                      v-if="getTaskBarData(task).overdueWidth > 0"
                      class="absolute inset-y-0 right-0 rounded-r-lg"
                      :style="{
                        width: `${getTaskBarData(task).fadeWidth}px`,
                        background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.95))'
                      }"
                    />
                  </div>

                  <!-- Due date line marker (orange vertical line) -->
                  <div
                    v-if="getTaskBarData(task).dueDateOffset !== null"
                    class="absolute inset-y-0 w-0.5 z-10"
                    :class="task.metrics.isOverdue ? 'bg-orange-500' : 'bg-slate-400'"
                    :style="{ left: `${getTaskBarData(task).dueDateOffset}px` }"
                    :title="`Due: ${formatDate(task.metrics.dueDate)}`"
                  />

                  <!-- Hover highlight -->
                  <div 
                    class="absolute inset-0 ring-2 ring-relai-500 ring-opacity-0 group-hover:ring-opacity-100 transition-all pointer-events-none"
                    :class="task.isSubtask ? 'rounded' : 'rounded-lg'"
                  />
                </div>
              </div>

              <!-- Empty state placeholder -->
              <div 
                v-if="activeTasks.length === 0"
                class="h-64 flex items-center justify-center text-gray-400"
              >
                No active tasks to display
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Hover tooltip -->
      <Teleport to="body">
          <Transition name="fade">
            <div
              v-if="hoveredTask"
              class="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 pointer-events-none"
              :class="hoveredTask.isSubtask ? 'w-56' : 'w-72'"
              :style="{
                left: `${hoverPosition.x + 200}px`,
                top: `${hoverPosition.y + 100}px`,
                transform: 'translate(-50%, 0)'
              }"
            >
              <!-- Task title -->
              <div class="font-semibold text-gray-900 mb-2">
                <span v-if="hoveredTask.isSubtask" class="text-gray-400 text-xs mr-1">↳</span>
                {{ hoveredTask.title }}
              </div>
              
              <!-- Status & Progress -->
              <div class="flex items-center gap-2 mb-3">
                <span 
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  :class="STATUS_CONFIG[hoveredTask.status].color"
                >
                  {{ STATUS_CONFIG[hoveredTask.status].label }}
                </span>
                <div class="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    class="h-full rounded-full"
                    :class="statusBarColors[hoveredTask.status]"
                    :style="{ width: `${hoveredTask.progress}%` }"
                  />
                </div>
                <span class="text-xs font-medium text-gray-600">{{ hoveredTask.progress }}%</span>
              </div>
              
              <!-- Metrics grid -->
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div class="bg-gray-50 rounded-lg p-2">
                  <div class="text-gray-500">Started</div>
                  <div class="font-medium text-gray-900">{{ formatDate(hoveredTask.metrics.startDate) }}</div>
                </div>
                <div class="bg-gray-50 rounded-lg p-2">
                  <div class="text-gray-500">Days Spent</div>
                  <div class="font-medium text-gray-900">{{ hoveredTask.metrics.daysSpent }}</div>
                </div>
                <div class="bg-gray-50 rounded-lg p-2">
                  <div class="text-gray-500">Est. Completion</div>
                  <div class="font-medium text-gray-900">{{ formatDate(hoveredTask.metrics.estimatedCompletionDate) }}</div>
                </div>
                <div class="bg-gray-50 rounded-lg p-2">
                  <div class="text-gray-500">Days Remaining</div>
                  <div class="font-medium text-gray-900">{{ formatDays(hoveredTask.metrics.estimatedDaysRemaining) }}</div>
                </div>
              </div>
              
              <!-- Uncertainty range -->
              <div class="mt-2 bg-blue-50 rounded-lg p-2 text-xs">
                <div class="text-blue-600 font-medium mb-1">
                  Confidence: {{ hoveredTask.confidence }}%
                </div>
                <div class="text-blue-700">
                  Range: {{ formatDate(hoveredTask.metrics.earliestCompletionDate) }} 
                  → {{ formatDate(hoveredTask.metrics.latestCompletionDate) }}
                </div>
              </div>
              
              <!-- Due date & overdue warning -->
              <div 
                v-if="hoveredTask.metrics.dueDate"
                class="mt-2 rounded-lg p-2 text-xs"
                :class="hoveredTask.metrics.isOverdue ? 'bg-rose-50' : 'bg-emerald-50'"
              >
                <div class="flex items-center justify-between">
                  <span :class="hoveredTask.metrics.isOverdue ? 'text-rose-600' : 'text-emerald-600'">
                    Due: {{ formatDate(hoveredTask.metrics.dueDate) }}
                  </span>
                  <span 
                    class="font-medium"
                    :class="hoveredTask.metrics.isOverdue ? 'text-rose-700' : 'text-emerald-700'"
                  >
                    {{ hoveredTask.metrics.isOverdue 
                      ? `${Math.abs(hoveredTask.metrics.daysOverdue)} days over` 
                      : `${Math.abs(hoveredTask.metrics.daysOverdue)} days ahead` 
                    }}
                  </span>
                </div>
              </div>
              
              <!-- Velocity -->
              <div class="mt-2 text-xs text-gray-500">
                Velocity: {{ hoveredTask.metrics.velocityPerDay }}% per day
              </div>
            </div>
          </Transition>
        </Teleport>
    </div>

    <!-- Legend -->
    <div class="border-t border-gray-200 bg-gray-50 px-4 py-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
      <span class="flex items-center gap-1.5">
        <div class="w-4 h-2 rounded bg-blue-500" />
        Progress
      </span>
      <span class="flex items-center gap-1.5">
        <div class="w-6 h-2 rounded-l bg-gray-300" style="mask-image: linear-gradient(to right, black, transparent); -webkit-mask-image: linear-gradient(to right, black, transparent);" />
        Uncertainty
      </span>
      <span class="flex items-center gap-1.5">
        <div class="w-6 h-2 rounded bg-orange-300" style="mask-image: linear-gradient(to right, black, transparent); -webkit-mask-image: linear-gradient(to right, black, transparent);" />
        Past Due
      </span>
      <span class="flex items-center gap-1.5">
        <div class="w-0.5 h-3 bg-orange-500" />
        Due Date
      </span>
      <span class="flex items-center gap-1.5">
        <div class="w-0.5 h-3 bg-relai-500" />
        Today
      </span>
    </div>
  </div>
</template>

<style scoped>
.timeline-container {
  height: 100%;
  min-height: 400px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Hide scrollbar but keep functionality */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
