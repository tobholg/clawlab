<script setup lang="ts">
import type { ItemNode } from '~/types'

const props = defineProps<{
  items: ItemNode[]
  isRootLevel?: boolean
}>()

const emit = defineEmits<{
  openItem: [item: ItemNode]
  openDetail: [item: ItemNode]
}>()

const hoveredForecast = ref<{ item: ItemNode | DisplayItem; est: EstimateMeta } | null>(null)
const forecastHoverPos = ref({ x: 0, y: 0 })
const forecastShowBelow = ref(false)

const updateForecastHoverPos = (event: MouseEvent) => {
  const tooltipHeight = 180
  forecastShowBelow.value = event.clientY < tooltipHeight
  forecastHoverPos.value = {
    x: event.clientX,
    y: event.clientY + (forecastShowBelow.value ? 20 : -10),
  }
}

const handleForecastEnter = (item: ItemNode | DisplayItem, event: MouseEvent) => {
  hoveredForecast.value = { item, est: getEstimatedCompletion(item) }
  updateForecastHoverPos(event)
}

const handleForecastMove = (event: MouseEvent) => {
  updateForecastHoverPos(event)
}

const handleForecastLeave = () => {
  hoveredForecast.value = null
}

// Zoom levels
type ZoomLevel = 'days' | 'weeks' | 'months' | 'quarters'
const zoomLevel = ref<ZoomLevel>('weeks')

// Expanded tasks state (for subtask expansion)
const expandedItems = ref<Set<string>>(new Set())

function toggleExpand(itemId: string, event: Event) {
  event.stopPropagation()
  if (expandedItems.value.has(itemId)) {
    expandedItems.value.delete(itemId)
  } else {
    expandedItems.value.add(itemId)
  }
  expandedItems.value = new Set(expandedItems.value)
}

const zoomOptions: { value: ZoomLevel; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'quarters', label: 'Quarters' },
]

// Flatten items with their children when expanded
interface DisplayItem extends ItemNode {
  isSubtask?: boolean
  parentId?: string | null
  depth?: number
}

interface EstimateMeta {
  startDate: Date
  estimatedEnd: Date
  earliestEnd: Date
  latestEnd: Date
  dueDate: Date | null
  isOverdue: boolean
  daysOverdue: number
  remainingDays: number
  bandDays: number
  missProb: number
  daysUntilDue: number
}

const displayItems = computed<DisplayItem[]>(() => {
  const result: DisplayItem[] = []
  
  const sortedItems = [...props.items].sort((a, b) => {
    const aStart = a.startDate ? new Date(a.startDate).getTime() : Date.now()
    const bStart = b.startDate ? new Date(b.startDate).getTime() : Date.now()
    return aStart - bStart
  })
  
  sortedItems.forEach(item => {
    result.push({ ...item, isSubtask: false, depth: 0 })
    
    if (expandedItems.value.has(item.id) && item.children?.length) {
      item.children
        .forEach(child => {
          result.push({
            ...child,
            isSubtask: true,
            parentId: item.id,
            depth: 1
          } as DisplayItem)
        })
    }
  })
  
  return result
})

// Calculate timeline range
const timelineRange = computed(() => {
  const now = new Date()
  const items = props.items

  // Minimum lookahead depends on zoom level
  const minMonthsAhead: Record<ZoomLevel, number> = {
    days: 2,
    weeks: 3,
    months: 12,
    quarters: 18,
  }

  let earliest = new Date(now)
  let latest = new Date(now)
  latest.setMonth(latest.getMonth() + minMonthsAhead[zoomLevel.value])

  items.forEach(item => {
    if (item.startDate) {
      const start = new Date(item.startDate)
      if (start < earliest) earliest = start
    }
    if (item.dueDate) {
      const due = new Date(item.dueDate)
      if (due > latest) latest = due
    }
  })

  earliest.setDate(earliest.getDate() - 7)
  latest.setDate(latest.getDate() + 14)

  // Normalize to start of day for consistent positioning
  earliest = new Date(earliest.getFullYear(), earliest.getMonth(), earliest.getDate())
  latest = new Date(latest.getFullYear(), latest.getMonth(), latest.getDate())

  return { start: earliest, end: latest }
})

const alignStartForZoom = (date: Date, zoom: ZoomLevel) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  if (zoom === 'weeks') {
    const day = d.getDay() // 0 = Sun
    const diff = (day + 6) % 7 // days since Monday
    d.setDate(d.getDate() - diff)
  } else if (zoom === 'months') {
    d.setDate(1)
  } else if (zoom === 'quarters') {
    const qStartMonth = Math.floor(d.getMonth() / 3) * 3
    d.setMonth(qStartMonth, 1)
  }
  return d
}

const alignEndForZoom = (date: Date, zoom: ZoomLevel) => {
  const d = alignStartForZoom(date, zoom)
  if (zoom === 'weeks') {
    d.setDate(d.getDate() + 7)
  } else if (zoom === 'months') {
    d.setMonth(d.getMonth() + 1, 1)
  } else if (zoom === 'quarters') {
    d.setMonth(d.getMonth() + 3, 1)
  } else {
    d.setDate(d.getDate() + 1)
  }
  return d
}

const alignedRange = computed(() => {
  const start = alignStartForZoom(timelineRange.value.start, zoomLevel.value)
  const end = alignEndForZoom(timelineRange.value.end, zoomLevel.value)
  return { start, end }
})

// Generate time columns based on zoom level
const timeColumns = computed(() => {
  const { start, end } = alignedRange.value
  const columns: { date: Date; label: string; isToday: boolean; isWeekend: boolean }[] = []
  const current = new Date(start)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  while (current <= end) {
    const isToday = current.toDateString() === today.toDateString()
    const isWeekend = current.getDay() === 0 || current.getDay() === 6
    
    let label = ''
    let shouldAdd = false
    
    switch (zoomLevel.value) {
      case 'days':
        label = `${current.getDate()} ${current.toLocaleDateString('en-US', { weekday: 'short' })}`
        shouldAdd = true
        break
      case 'weeks':
        if (current.getDay() === 1 || columns.length === 0) {
          label = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          shouldAdd = true
        }
        break
      case 'months':
        if (current.getDate() === 1 || columns.length === 0) {
          label = current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
          shouldAdd = true
        }
        break
      case 'quarters':
        if (current.getMonth() % 3 === 0 && current.getDate() === 1 || columns.length === 0) {
          const q = Math.floor(current.getMonth() / 3) + 1
          label = `Q${q} ${current.getFullYear()}`
          shouldAdd = true
        }
        break
    }
    
    if (shouldAdd) {
      columns.push({ date: new Date(current), label, isToday, isWeekend })
    }
    
    current.setDate(current.getDate() + 1)
  }
  
  return columns
})

// Column width in pixels based on zoom level
const columnWidth = computed(() => {
  switch (zoomLevel.value) {
    case 'days': return 56
    case 'weeks': return 80
    case 'months': return 96
    case 'quarters': return 128
    default: return 60
  }
})

// Total width of the timeline area
const totalWidth = computed(() => timeColumns.value.length * columnWidth.value)

// Calculate estimated completion data for an item
const getEstimatedCompletion = (item: ItemNode | DisplayItem): EstimateMeta => {
  const today = new Date()
  const startDate = item.startDate ? new Date(item.startDate) : today
  const progress = item.progress ?? 0
  const confidence = item.confidence ?? 70
  const dueDate = item.dueDate ? new Date(item.dueDate) : null
  
  if (progress >= 100) {
    return {
      startDate,
      estimatedEnd: today,
      earliestEnd: today,
      latestEnd: today,
      dueDate,
      isOverdue: false,
      daysOverdue: 0,
      remainingDays: 0,
      bandDays: 0,
      missProb: 0,
      daysUntilDue: 0,
    }
  }
  
  let estimatedEnd: Date
  let remainingDays: number
  
  if (item.startDate && progress > 0) {
    const daysSpent = Math.max(1, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const totalEstimate = Math.round(daysSpent / (progress / 100))
    remainingDays = Math.max(1, totalEstimate - daysSpent)
    estimatedEnd = new Date(today.getTime() + remainingDays * 24 * 60 * 60 * 1000)
  } else if (dueDate) {
    // No progress but has due date — use due date as the estimated end
    remainingDays = Math.max(1, Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    estimatedEnd = new Date(dueDate)
  } else {
    remainingDays = 14
    estimatedEnd = new Date(startDate.getTime() + 14 * 24 * 60 * 60 * 1000)
  }
  
  const bandDays = Math.ceil(remainingDays * (1 - confidence / 100) * 2)
  const earliestEnd = new Date(estimatedEnd.getTime() - Math.floor(bandDays / 2) * 24 * 60 * 60 * 1000)
  const latestEnd = new Date(estimatedEnd.getTime() + Math.ceil(bandDays / 2) * 24 * 60 * 60 * 1000)
  
  const isOverdue = dueDate && estimatedEnd > dueDate
  const daysOverdue = isOverdue ? Math.ceil((estimatedEnd.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
  
  let missProb = 0
  let daysUntilDue = 0
  if (dueDate) {
    daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const stdDev = Math.max(1, bandDays / 4)
    const zScore = (daysUntilDue - remainingDays) / stdDev
    const cdf = 1 / (1 + Math.exp(-1.702 * zScore))
    missProb = Math.round((1 - cdf) * 100)
    missProb = Math.max(0, Math.min(100, missProb))
  }

  return {
    startDate,
    estimatedEnd,
    earliestEnd,
    latestEnd,
    dueDate,
    isOverdue,
    daysOverdue,
    remainingDays,
    bandDays,
    missProb,
    daysUntilDue,
  }
}

// Get pixels per day
const pixelsPerDay = computed(() => {
  const start = visibleStartDate.value
  const end = visibleEndDate.value
  const totalVisibleDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  return totalWidth.value / totalVisibleDays
})

// Get position and width for an item
const getItemStyle = (item: ItemNode | DisplayItem) => {
  const rangeStart = visibleStartDate.value
  const ppd = pixelsPerDay.value
  const est = getEstimatedCompletion(item)
  
  const startOffset = (est.startDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
  const duration = Math.max(1, (est.latestEnd.getTime() - est.startDate.getTime()) / (1000 * 60 * 60 * 24))
  
  return {
    left: `${startOffset * ppd}px`,
    width: `${Math.max(20, duration * ppd)}px`,
  }
}

// Forecast range styles within a bar
const getForecastRange = (item: ItemNode | DisplayItem) => {
  const est = getEstimatedCompletion(item)
  if (!est || item.status === 'done') return null

  const ppd = pixelsPerDay.value
  const dayMs = 1000 * 60 * 60 * 24
  const rangeLeft = Math.max(0, (est.earliestEnd.getTime() - est.startDate.getTime()) / dayMs * ppd)
  const rangeRight = Math.max(0, (est.latestEnd.getTime() - est.startDate.getTime()) / dayMs * ppd)
  const rangeWidth = Math.max(6, rangeRight - rangeLeft)
  const baseLeft = Math.max(0, (est.estimatedEnd.getTime() - est.startDate.getTime()) / dayMs * ppd)
  const dueLeft = est.dueDate
    ? Math.max(0, (est.dueDate.getTime() - est.startDate.getTime()) / dayMs * ppd)
    : null

  return {
    rangeLeft,
    rangeWidth,
    baseLeft,
    dueLeft,
    isOverdue: est.isOverdue,
  }
}

const visibleStartDate = computed(() => {
  const base = timeColumns.value.length > 0 ? timeColumns.value[0].date : alignedRange.value.start
  return alignStartForZoom(base, zoomLevel.value)
})

const visibleEndDate = computed(() => {
  if (timeColumns.value.length === 0) return alignedRange.value.end
  const lastCol = timeColumns.value[timeColumns.value.length - 1].date
  const daysPerColumn = zoomLevel.value === 'days' ? 1 : 
                        zoomLevel.value === 'weeks' ? 7 : 
                        zoomLevel.value === 'months' ? 30 : 90
  const end = new Date(lastCol.getTime() + daysPerColumn * 24 * 60 * 60 * 1000)
  return new Date(end.getFullYear(), end.getMonth(), end.getDate())
})

const todayPosition = computed(() => {
  const start = visibleStartDate.value
  const end = visibleEndDate.value
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const totalVisibleDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  const offset = (today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  const ppd = totalWidth.value / totalVisibleDays
  return `${Math.max(0, offset * ppd)}px`
})

// Category color mapping
const categoryColors: Record<string, { bar: string; bg: string }> = {
  'Engineering': { bar: 'from-blue-400 to-blue-500', bg: 'bg-blue-100 dark:bg-blue-500/10' },
  'Bug': { bar: 'from-rose-400 to-rose-500', bg: 'bg-rose-100 dark:bg-rose-500/10' },
  'Design': { bar: 'from-violet-400 to-violet-500', bg: 'bg-violet-100 dark:bg-violet-500/10' },
  'Product': { bar: 'from-indigo-400 to-indigo-500', bg: 'bg-indigo-100 dark:bg-indigo-500/10' },
  'QA': { bar: 'from-amber-400 to-amber-500', bg: 'bg-amber-100 dark:bg-amber-500/10' },
  'Research': { bar: 'from-cyan-400 to-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-500/10' },
  'Operations': { bar: 'from-orange-400 to-orange-500', bg: 'bg-orange-100 dark:bg-orange-500/10' },
  'Marketing': { bar: 'from-pink-400 to-pink-500', bg: 'bg-pink-100 dark:bg-pink-500/10' },
  'default': { bar: 'from-slate-400 to-slate-500', bg: 'bg-slate-100 dark:bg-white/[0.08]' },
}

const getBarColor = (item: ItemNode | DisplayItem) => {
  if (item.status === 'done') return 'from-emerald-400 to-emerald-500'
  if (item.status === 'blocked') return 'from-rose-400 to-rose-500'
  return categoryColors[item.category || 'default']?.bar || categoryColors.default.bar
}

const getBgColor = (item: ItemNode | DisplayItem) => {
  if (item.status === 'done') return 'bg-emerald-100 dark:bg-emerald-500/10'
  if (item.status === 'blocked') return 'bg-rose-100 dark:bg-rose-500/10'
  return categoryColors[item.category || 'default']?.bg || categoryColors.default.bg
}

const getRangeColor = (item: ItemNode | DisplayItem) => {
  const est = getEstimatedCompletion(item)
  if (est.isOverdue) return 'from-amber-400 to-orange-500'
  return getBarColor(item)
}

const formatShortDate = (d: Date | null) => {
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getRiskTextClass = (missProb: number) => {
  if (missProb > 66) return 'text-rose-400'
  if (missProb > 33) return 'text-amber-400'
  return 'text-emerald-400'
}

// Expand/collapse all
const hasExpandableItems = computed(() =>
  props.items.some(item => item.children && item.children.length > 0)
)
const allExpanded = computed(() => {
  const expandable = props.items.filter(item => item.children && item.children.length > 0)
  return expandable.length > 0 && expandable.every(item => expandedItems.value.has(item.id))
})

function toggleExpandAll() {
  if (allExpanded.value) {
    expandedItems.value = new Set()
  } else {
    const ids = props.items
      .filter(item => item.children && item.children.length > 0)
      .map(item => item.id)
    expandedItems.value = new Set(ids)
  }
}

// Scroll sync refs
const headerScrollRef = ref<HTMLElement | null>(null)
const timelineScrollRef = ref<HTMLElement | null>(null)

function syncTimelineScroll(event: Event) {
  const target = event.target as HTMLElement
  if (headerScrollRef.value) {
    headerScrollRef.value.scrollLeft = target.scrollLeft
  }
}

function syncHeaderScroll(event: Event) {
  const target = event.target as HTMLElement
  if (timelineScrollRef.value) {
    timelineScrollRef.value.scrollLeft = target.scrollLeft
  }
}

// Drag-to-scroll on header
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartScrollLeft = ref(0)

function onHeaderPointerDown(event: PointerEvent) {
  const el = headerScrollRef.value
  if (!el) return
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartScrollLeft.value = el.scrollLeft
  el.setPointerCapture(event.pointerId)
  el.style.cursor = 'grabbing'
}

function onHeaderPointerMove(event: PointerEvent) {
  if (!isDragging.value) return
  const el = headerScrollRef.value
  if (!el) return
  const dx = event.clientX - dragStartX.value
  el.scrollLeft = dragStartScrollLeft.value - dx
}

function onHeaderPointerUp(event: PointerEvent) {
  if (!isDragging.value) return
  isDragging.value = false
  const el = headerScrollRef.value
  if (!el) return
  el.releasePointerCapture(event.pointerId)
  el.style.cursor = 'grab'
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div class="text-sm text-slate-500 dark:text-zinc-400">
        {{ items.length }} {{ isRootLevel ? 'projects' : 'items' }} on timeline
      </div>
      
      <div class="flex items-center gap-2">
        <!-- Expand/collapse all -->
        <button
          v-if="hasExpandableItems"
          @click="toggleExpandAll"
          class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.06] rounded-lg transition-colors"
          :title="allExpanded ? 'Collapse all' : 'Expand all'"
        >
          <Icon
            :name="allExpanded ? 'heroicons:bars-arrow-up' : 'heroicons:bars-arrow-down'"
            class="w-3.5 h-3.5"
          />
          {{ allExpanded ? 'Collapse' : 'Expand' }}
        </button>

        <!-- Zoom toggle -->
        <div class="flex items-center gap-1 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.06] rounded-lg p-0.5">
          <button
            v-for="opt in zoomOptions"
            :key="opt.value"
            @click="zoomLevel = opt.value"
            :class="[
              'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
              zoomLevel === opt.value
                ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-800 dark:text-zinc-200'
                : 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'
            ]"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>
    
    <!-- Timeline -->
    <div class="flex-1 bg-white dark:bg-dm-card rounded-xl border border-slate-100 dark:border-white/[0.06] overflow-hidden flex flex-col">
      <!-- Fixed headers row -->
      <div class="flex flex-shrink-0 border-b border-slate-100 dark:border-white/[0.06]">
        <!-- Tasks column header -->
        <div class="w-52 flex-shrink-0 h-10 px-4 flex items-center border-r border-slate-100 dark:border-white/[0.06] bg-slate-50/80 dark:bg-white/[0.04]">
          <span class="text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wide">
            {{ isRootLevel ? 'Projects' : 'Tasks' }}
          </span>
        </div>
        
        <!-- Time header (scrolls horizontally with timeline, drag to scroll) -->
        <div
          ref="headerScrollRef"
          class="flex-1 overflow-x-auto scrollbar-hide cursor-grab select-none"
          @scroll="syncHeaderScroll"
          @pointerdown="onHeaderPointerDown"
          @pointermove="onHeaderPointerMove"
          @pointerup="onHeaderPointerUp"
          @pointercancel="onHeaderPointerUp"
        >
          <div class="h-10 bg-slate-50/80 dark:bg-white/[0.04] flex" :style="{ width: `${totalWidth}px`, minWidth: '100%' }">
            <div 
              v-for="(col, i) in timeColumns" 
              :key="i"
              :class="[
                'flex-shrink-0 px-1 flex items-center justify-center border-r border-slate-100 dark:border-white/[0.06] last:border-r-0',
                zoomLevel === 'days' ? 'w-14' : 
                zoomLevel === 'weeks' ? 'w-20' : 
                zoomLevel === 'months' ? 'w-24' : 'w-32'
              ]"
            >
              <span 
                :class="[
                  'text-[10px] font-medium whitespace-nowrap',
                  col.isToday ? 'text-blue-600' : 'text-slate-500 dark:text-zinc-400'
                ]"
              >
                {{ col.label }}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Scrollable body (tasks + timeline scroll together vertically) -->
      <div class="flex-1 overflow-y-auto">
        <div class="flex min-h-full">
          <!-- Sticky row labels column -->
          <div class="w-52 flex-shrink-0 border-r border-slate-100 dark:border-white/[0.06] bg-white dark:bg-dm-card sticky left-0 z-10">
            <div 
              v-for="item in displayItems" 
              :key="item.id + '-label'"
              class="border-b border-slate-50 dark:border-white/[0.04] hover:bg-slate-50/50 dark:hover:bg-white/[0.04] transition-colors group cursor-pointer"
              :class="item.isSubtask ? 'h-10 bg-slate-50/30 dark:bg-white/[0.02]' : 'h-12'"
              @click="emit('openDetail', item)"
            >
              <div 
                class="h-full flex items-center gap-2"
                :class="item.isSubtask ? 'pl-6 pr-2' : 'px-3'"
              >
                <!-- Subtask connector -->
                <div v-if="item.isSubtask" class="flex-shrink-0 w-3 h-full relative">
                  <div class="absolute left-0 top-0 bottom-1/2 w-px bg-slate-200 dark:bg-zinc-700" />
                  <div class="absolute left-0 top-1/2 w-3 h-px bg-slate-200 dark:bg-zinc-700" />
                </div>
                
                <!-- Status dot -->
                <div 
                  :class="[
                    'rounded-full flex-shrink-0',
                    item.isSubtask ? 'w-1.5 h-1.5' : 'w-2 h-2',
                    item.status === 'done' ? 'bg-emerald-500' :
                    item.status === 'blocked' ? 'bg-rose-500' :
                    item.status === 'in_progress' ? 'bg-blue-500' :
                    'bg-slate-400 dark:bg-zinc-500'
                  ]"
                />
                
                <!-- Item info -->
                <div class="flex-1 min-w-0">
                  <span 
                    class="font-medium text-slate-700 dark:text-zinc-300 truncate block group-hover:text-blue-600 transition-colors"
                    :class="item.isSubtask ? 'text-xs' : 'text-sm'"
                  >
                    {{ item.title }}
                  </span>
                  <div 
                    v-if="!item.isSubtask" 
                    class="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-zinc-500"
                  >
                    <span>{{ item.progress || 0 }}%</span>
                    <span v-if="item.children?.length" class="text-slate-300 dark:text-zinc-600">
                      · {{ item.children.length }}
                    </span>
                  </div>
                  <div v-else class="text-[10px] text-slate-400 dark:text-zinc-500">
                    {{ item.progress || 0 }}%
                  </div>
                </div>
                
                <!-- Expand/collapse button -->
                <button
                  v-if="!item.isSubtask && item.children && item.children.length > 0"
                  class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-white/[0.06] transition-colors"
                  @click="toggleExpand(item.id, $event)"
                >
                  <Icon 
                    name="heroicons:chevron-down" 
                    class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 transition-transform duration-200"
                    :class="expandedItems.has(item.id) ? 'rotate-180' : ''"
                  />
                </button>
              </div>
            </div>
          </div>
          
          <!-- Scrollable timeline area (horizontal scroll) -->
          <div 
            ref="timelineScrollRef"
            class="flex-1 overflow-x-auto"
            @scroll="syncTimelineScroll"
          >
            <div class="relative" :style="{ width: `${totalWidth}px`, minWidth: '100%' }">
              <!-- Today marker -->
              <div 
                class="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 pointer-events-none"
                :style="{ left: todayPosition }"
              >
                <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-500 rounded-full" />
              </div>
              
              <!-- Item rows -->
              <div 
                v-for="item in displayItems" 
                :key="item.id"
                class="relative border-b border-slate-50 dark:border-white/[0.04] hover:bg-slate-50/50 dark:hover:bg-white/[0.04] transition-colors"
                :class="item.isSubtask ? 'h-10' : 'h-12'"
              >
                <!-- Grid lines -->
                <div class="absolute inset-0 flex pointer-events-none">
                  <div 
                    v-for="(col, i) in timeColumns" 
                    :key="i"
                    :class="[
                      'flex-shrink-0 border-r',
                      col.isWeekend ? 'bg-slate-50/50 dark:bg-white/[0.03] border-slate-100 dark:border-white/[0.06]' : 'border-slate-50 dark:border-white/[0.04]',
                      zoomLevel === 'days' ? 'w-14' : 
                      zoomLevel === 'weeks' ? 'w-20' : 
                      zoomLevel === 'months' ? 'w-24' : 'w-32'
                    ]"
                  />
                </div>
                
                <!-- Item bar -->
                <div 
                  class="absolute top-1/2 -translate-y-1/2 rounded-lg cursor-pointer transition-all hover:scale-y-110 group/bar overflow-hidden"
                  :class="[getBgColor(item), item.isSubtask ? 'h-5' : 'h-7']"
                  :style="getItemStyle(item)"
                  @click="emit('openDetail', item)"
                >
                  <!-- Progress fill -->
                  <div 
                    class="absolute inset-y-0 left-0 rounded-l-lg bg-gradient-to-r transition-all"
                    :class="getBarColor(item)"
                    :style="{ width: `${item.progress || 0}%` }"
                  />

                  <!-- Forecast range capsule -->
                  <div
                    v-if="getForecastRange(item)"
                    class="absolute top-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r opacity-70"
                    :class="[getRangeColor(item), item.isSubtask ? 'h-2.5' : 'h-3']"
                    :style="{
                      left: `${getForecastRange(item)?.rangeLeft}px`,
                      width: `${getForecastRange(item)?.rangeWidth}px`
                    }"
                    @mouseenter="handleForecastEnter(item, $event)"
                    @mousemove="handleForecastMove"
                    @mouseleave="handleForecastLeave"
                  />

                  <!-- Base estimate marker -->
                  <div
                    v-if="getForecastRange(item)"
                    class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-white dark:bg-zinc-300 shadow ring-1 ring-slate-400 dark:ring-zinc-600"
                    :style="{ left: `${getForecastRange(item)?.baseLeft}px` }"
                  />

                  <!-- Due date marker -->
                  <div 
                    v-if="item.dueDate && getForecastRange(item)?.dueLeft !== null"
                    class="absolute inset-y-0 w-[2px] bg-slate-600 dark:bg-zinc-500"
                    :style="{ left: `calc(${getForecastRange(item)?.dueLeft}px - 1px)` }"
                  />
                  
                  <!-- Tooltip -->
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover/bar:opacity-100 transition-opacity pointer-events-none z-20 min-w-[200px]">
                    <div class="font-semibold text-sm mb-2">{{ item.title }}</div>
                    <div class="space-y-1.5 text-slate-300">
                      <div class="flex items-center justify-between">
                        <span>Progress</span>
                        <span class="font-medium text-white">{{ item.progress || 0 }}%</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span>Confidence</span>
                        <span class="font-medium text-white">{{ item.confidence || 70 }}%</span>
                      </div>
                      <div v-if="item.dueDate" class="flex items-center justify-between">
                        <span>Due</span>
                        <span :class="getEstimatedCompletion(item).isOverdue ? 'text-amber-400' : 'text-white'">
                          {{ new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Empty state -->
              <div 
                v-if="items.length === 0"
                class="flex items-center justify-center py-12 text-slate-400 dark:text-zinc-500"
              >
                <div class="text-center">
                  <Icon name="heroicons:calendar" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p class="text-sm">No items to display on timeline</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Legend -->
    <div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-zinc-400">
      <span class="flex items-center gap-1.5">
        <div class="w-4 h-2 rounded bg-gradient-to-r from-blue-400 to-blue-500" />
        Progress
      </span>
      <span class="flex items-center gap-1.5">
        <div class="relative w-6 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 opacity-70">
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-300 shadow ring-1 ring-slate-400 dark:ring-zinc-600"></div>
        </div>
        Estimate range
      </span>
      <span class="flex items-center gap-1.5">
        <div class="w-0.5 h-3 bg-slate-600 dark:bg-zinc-500" />
        Due Date
      </span>
      <span class="flex items-center gap-1.5">
        <div class="w-0.5 h-3 bg-blue-500" />
        Today
      </span>
    </div>

    <!-- Forecast tooltip -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="hoveredForecast"
          class="fixed z-50 pointer-events-none"
          :style="{
            left: `${forecastHoverPos.x}px`,
            top: `${forecastHoverPos.y}px`,
            transform: forecastShowBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)'
          }"
        >
          <div class="bg-slate-900 text-white rounded-lg shadow-xl px-3 py-2 max-w-xs relative text-xs">
            <div class="text-[10px] font-medium text-slate-300 mb-1.5 pb-1.5 border-b border-slate-700">
              Forecast window
              <span
                v-if="hoveredForecast.est.missProb > 0"
                :class="['ml-2', getRiskTextClass(hoveredForecast.est.missProb)]"
              >
                {{ hoveredForecast.est.missProb }}% risk
              </span>
            </div>
            <div class="space-y-1.5 text-slate-300">
              <div class="flex items-center justify-between gap-4">
                <span>Range</span>
                <span class="text-white">
                  {{ formatShortDate(hoveredForecast.est.earliestEnd) }} – {{ formatShortDate(hoveredForecast.est.latestEnd) }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-4">
                <span>Most likely</span>
                <span class="text-white">{{ formatShortDate(hoveredForecast.est.estimatedEnd) }}</span>
              </div>
              <div v-if="hoveredForecast.est.dueDate" class="flex items-center justify-between gap-4">
                <span>Due</span>
                <span class="text-white">{{ formatShortDate(hoveredForecast.est.dueDate) }}</span>
              </div>
            </div>

            <div
              v-if="forecastShowBelow"
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

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
