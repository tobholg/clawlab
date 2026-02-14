<script setup lang="ts">
import type { ItemNode } from '~/types'
import { getItemEstimateMeta } from '~/utils/itemRisk'
import { STATUS_CONFIG, SUB_STATUS_CONFIG, PRIORITY_OPTIONS } from '~/types'

const props = defineProps<{
  items: ItemNode[]
  isRootLevel?: boolean
}>()

const emit = defineEmits<{
  openItem: [item: ItemNode]
  openDetail: [item: ItemNode]
}>()

// Expanded state
const expandedIds = ref<Set<string>>(new Set())

// ===== FILTERING =====
const searchQuery = ref('')
const statusFilter = ref<string[]>([])
const categoryFilter = ref<string[]>([])
const assigneeFilter = ref<string[]>([])
const riskFilter = ref<string[]>([])

// Get unique values for filter dropdowns
const availableStatuses = computed(() => Object.keys(STATUS_CONFIG))
const availableCategories = computed(() => {
  const cats = new Set<string>()
  const collect = (items: ItemNode[]) => {
    items.forEach(item => {
      if (item.category) cats.add(item.category)
      if (item.children) collect(item.children)
    })
  }
  collect(props.items)
  return Array.from(cats).sort()
})
const availableAssignees = computed(() => {
  const assignees = new Map<string, { id: string; name: string }>()
  const collect = (items: ItemNode[]) => {
    items.forEach(item => {
      if (item.assignee) assignees.set(item.assignee.id, item.assignee)
      if (item.children) collect(item.children)
    })
  }
  collect(props.items)
  return Array.from(assignees.values()).sort((a, b) => a.name.localeCompare(b.name))
})

// Smart presets
const activePreset = ref<string | null>(null)
function applyPreset(preset: string) {
  clearFilters()
  activePreset.value = preset
  switch (preset) {
    case 'needs-attention':
      statusFilter.value = ['blocked']
      riskFilter.value = ['high', 'medium']
      break
    case 'at-risk':
      riskFilter.value = ['high', 'medium']
      break
    case 'due-this-week':
      // Will be handled in filter logic
      break
    case 'my-tasks':
      // Would need current user context
      break
  }
}

function clearFilters() {
  searchQuery.value = ''
  statusFilter.value = []
  categoryFilter.value = []
  assigneeFilter.value = []
  riskFilter.value = []
  activePreset.value = null
}

const hasActiveFilters = computed(() => 
  searchQuery.value || 
  statusFilter.value.length > 0 || 
  categoryFilter.value.length > 0 || 
  assigneeFilter.value.length > 0 ||
  riskFilter.value.length > 0 ||
  activePreset.value
)

// ===== SORTING =====
type SortColumn = 'title' | 'status' | 'progress' | 'confidence' | 'estCompletion' | 'dueDate' | 'priority' | 'risk' | 'assignee' | 'category'
const sortColumn = ref<SortColumn | null>(null)
const sortDirection = ref<'asc' | 'desc'>('asc')

function toggleSort(column: SortColumn) {
  if (sortColumn.value === column) {
    if (sortDirection.value === 'asc') {
      sortDirection.value = 'desc'
    } else {
      sortColumn.value = null
      sortDirection.value = 'asc'
    }
  } else {
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

// Toggle single item
function toggleExpand(id: string, event?: Event) {
  event?.stopPropagation()
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
  expandedIds.value = new Set(expandedIds.value)
}

// Expand/Collapse all
function expandAll() {
  const allIds = new Set<string>()
  const addIds = (items: ItemNode[]) => {
    items.forEach(item => {
      if (item.children?.length) {
        allIds.add(item.id)
        addIds(item.children)
      }
    })
  }
  addIds(props.items)
  expandedIds.value = allIds
}

function collapseAll() {
  expandedIds.value = new Set()
}

function expandToLevel(level: number) {
  const ids = new Set<string>()
  const addIds = (items: ItemNode[], currentLevel: number) => {
    if (currentLevel >= level) return
    items.forEach(item => {
      if (item.children?.length) {
        ids.add(item.id)
        addIds(item.children, currentLevel + 1)
      }
    })
  }
  addIds(props.items, 0)
  expandedIds.value = ids
}

// Flatten items for display
interface FlatItem extends ItemNode {
  depth: number
  isExpanded: boolean
  hasChildren: boolean
  riskLevel: 'low' | 'medium' | 'high' | null
  needsEstimate: boolean
}

// Check if an item matches current filters
function matchesFilters(item: ItemNode): boolean {
  // Search query
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    if (!item.title.toLowerCase().includes(q)) return false
  }
  
  // Status filter
  if (statusFilter.value.length > 0 && !statusFilter.value.includes(item.status)) {
    return false
  }
  
  // Category filter
  if (categoryFilter.value.length > 0 && (!item.category || !categoryFilter.value.includes(item.category))) {
    return false
  }
  
  // Assignee filter
  if (assigneeFilter.value.length > 0 && (!item.assignee || !assigneeFilter.value.includes(item.assignee.id))) {
    return false
  }
  
  // Risk filter
  if (riskFilter.value.length > 0) {
    const risk = getRiskLevel(item)
    if (!risk || !riskFilter.value.includes(risk)) return false
  }
  
  // Due this week preset
  if (activePreset.value === 'due-this-week' && item.dueDate) {
    const due = new Date(item.dueDate)
    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    if (due > weekFromNow) return false
  }
  
  return true
}

// Filter items recursively (keep parents if any child matches)
function filterItems(items: ItemNode[]): ItemNode[] {
  return items.reduce<ItemNode[]>((acc, item) => {
    const filteredChildren = item.children ? filterItems(item.children) : []
    const selfMatches = matchesFilters(item)
    const hasMatchingChildren = filteredChildren.length > 0
    
    if (selfMatches || hasMatchingChildren) {
      acc.push({
        ...item,
        children: filteredChildren,
      })
    }
    
    return acc
  }, [])
}

// Sort items
function sortItems(items: FlatItem[]): FlatItem[] {
  if (!sortColumn.value) return items
  
  return [...items].sort((a, b) => {
    let comparison = 0
    
    switch (sortColumn.value) {
      case 'title':
        comparison = a.title.localeCompare(b.title)
        break
      case 'status':
        const statusOrder = { todo: 0, in_progress: 1, blocked: 2, paused: 3, done: 4 }
        comparison = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0)
        break
      case 'progress':
        comparison = (a.progress ?? 0) - (b.progress ?? 0)
        break
      case 'confidence':
        comparison = (a.confidence ?? 70) - (b.confidence ?? 70)
        break
      case 'dueDate':
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
        comparison = aDate - bDate
        break
      case 'priority':
        const priorityOrder: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 }
        const aPriority = priorityOrder[a.priority ?? 'MEDIUM'] ?? 1
        const bPriority = priorityOrder[b.priority ?? 'MEDIUM'] ?? 1
        comparison = aPriority - bPriority
        break
      case 'risk':
        const riskOrder = { high: 0, medium: 1, low: 2 }
        comparison = (riskOrder[a.riskLevel ?? 'low'] ?? 3) - (riskOrder[b.riskLevel ?? 'low'] ?? 3)
        break
      case 'assignee':
        comparison = (a.assignee?.name ?? 'zzz').localeCompare(b.assignee?.name ?? 'zzz')
        break
      case 'category':
        comparison = (a.category ?? 'zzz').localeCompare(b.category ?? 'zzz')
        break
    }
    
    return sortDirection.value === 'desc' ? -comparison : comparison
  })
}

const flattenedItems = computed<FlatItem[]>(() => {
  // First, filter the items
  const filtered = hasActiveFilters.value ? filterItems(props.items) : props.items
  
  const result: FlatItem[] = []
  
  const flatten = (items: ItemNode[], depth: number) => {
    items.forEach(item => {
      const hasChildren = (item.children?.length ?? 0) > 0 || (item.childrenCount ?? 0) > 0
      const isExpanded = expandedIds.value.has(item.id)
      
      const meta = getItemEstimateMeta(item)

      result.push({
        ...item,
        depth,
        isExpanded,
        hasChildren,
        riskLevel: getRiskLevel(item),
        needsEstimate: meta.needsEstimate,
      })
      
      if (isExpanded && item.children?.length) {
        flatten(item.children, depth + 1)
      }
    })
  }
  
  flatten(filtered, 0)
  
  // Sort only top-level items to preserve tree structure
  // For now, we'll sort all items but this could be improved
  return sortColumn.value ? sortItems(result) : result
})

// Calculate estimated completion for an item
function getEstimatedCompletion(item: ItemNode) {
  const progress = item.progress ?? 0
  const confidence = item.confidence ?? 70
  const startDate = item.startDate
  
  if (!startDate || progress === 0) return null
  
  const start = new Date(startDate)
  const now = new Date()
  const daysSpent = Math.max(1, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
  
  if (progress >= 100) return { complete: true, daysRemaining: 0 }
  
  const totalEstimate = Math.round(daysSpent / (progress / 100))
  const remainingDays = Math.max(1, totalEstimate - daysSpent)

  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() + remainingDays)

  // Uncertainty band based on confidence (matches ItemDetailModal)
  const bandDays = Math.ceil(remainingDays * (1 - confidence / 100) * 2)

  const earliest = new Date(baseDate)
  earliest.setDate(earliest.getDate() - Math.floor(bandDays / 2))
  const latest = new Date(baseDate)
  latest.setDate(latest.getDate() + Math.ceil(bandDays / 2))
  
  return {
    complete: false,
    daysRemaining: Math.round(remainingDays),
    earliest,
    latest,
    baseDate,
  }
}

// Calculate risk level
function getRiskLevel(item: ItemNode): 'low' | 'medium' | 'high' | null {
  if (item.status === 'done') return null
  if (item.status === 'blocked') return 'high'
  
  const meta = getItemEstimateMeta(item)
  if (!item.dueDate || meta.needsEstimate) return null

  if (meta.isAtRisk) {
    return meta.missProb >= 66 ? 'high' : 'medium'
  }
  return 'low'
}

// Format date
function formatDate(date: string | Date | null): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Format date range
function formatDateRange(est: ReturnType<typeof getEstimatedCompletion>): string {
  if (!est) return '—'
  if (est.complete) return 'Done'
  return `${formatDate(est.earliest)} – ${formatDate(est.latest)}`
}

// Category colors
const categoryDotColors: Record<string, string> = {
  'Engineering': 'bg-blue-500',
  'Bug': 'bg-rose-500',
  'Design': 'bg-violet-500',
  'Product': 'bg-indigo-500',
  'QA': 'bg-amber-500',
  'Research': 'bg-cyan-500',
  'Operations': 'bg-orange-500',
  'Marketing': 'bg-pink-500',
}

const priorityDotColors: Record<string, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-rose-500',
}

const priorityLabelMap: Record<string, string> = Object.fromEntries(
  PRIORITY_OPTIONS.map(opt => [opt.value, opt.label])
)

// Depth-based styling
function getDepthIcon(depth: number, isProject: boolean) {
  if (depth === 0 && isProject) return 'heroicons:folder'
  if (depth === 0) return 'heroicons:clipboard-document-list'
  if (depth === 1) return 'heroicons:document-text'
  return 'heroicons:document'
}

function getDepthIconColor(depth: number, isProject: boolean) {
  if (depth === 0 && isProject) return 'text-blue-500'
  if (depth === 0) return 'text-emerald-500'
  if (depth === 1) return 'text-slate-500 dark:text-zinc-400'
  return 'text-slate-400 dark:text-zinc-500'
}

// Row click
function handleRowClick(item: FlatItem) {
  emit('openDetail', item)
}

// Scroll sync for header ↔ body
const headerScrollRef = ref<HTMLElement | null>(null)
const bodyScrollRef = ref<HTMLElement | null>(null)

function syncBodyScroll(event: Event) {
  const target = event.target as HTMLElement
  if (headerScrollRef.value) {
    headerScrollRef.value.scrollLeft = target.scrollLeft
  }
}

function syncHeaderScroll(event: Event) {
  const target = event.target as HTMLElement
  if (bodyScrollRef.value) {
    bodyScrollRef.value.scrollLeft = target.scrollLeft
  }
}

// Drag-to-scroll on header
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartScrollLeft = ref(0)

function onHeaderPointerDown(event: PointerEvent) {
  // Don't start drag if clicking a sort button
  if ((event.target as HTMLElement).closest('[data-sort-btn]')) return
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
  <div class="h-full flex flex-col bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.03]">
      <div class="flex items-center gap-4">
        <span class="text-sm font-medium text-slate-700 dark:text-zinc-300">
          {{ flattenedItems.length }} items
        </span>
        
        <!-- Expand/Collapse controls -->
        <div class="flex items-center gap-1 border-l border-slate-200 dark:border-white/[0.06] pl-4">
          <button
            @click="expandAll"
            class="px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded transition-colors"
          >
            Expand All
          </button>
          <button
            @click="collapseAll"
            class="px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded transition-colors"
          >
            Collapse All
          </button>
          <div class="w-px h-4 bg-slate-200 dark:bg-white/[0.06] mx-1" />
          <button
            @click="expandToLevel(1)"
            class="px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded transition-colors"
            title="Expand to Level 1"
          >
            L1
          </button>
          <button
            @click="expandToLevel(2)"
            class="px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded transition-colors"
            title="Expand to Level 2"
          >
            L2
          </button>
          <button
            @click="expandToLevel(3)"
            class="px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded transition-colors"
            title="Expand to Level 3"
          >
            L3
          </button>
        </div>
      </div>
      
    </div>
    
    <!-- Filter Bar -->
    <div class="px-4 py-2 border-b border-slate-100 dark:border-white/[0.06] bg-white dark:bg-dm-card flex flex-wrap items-center gap-3">
      <!-- Search -->
      <div class="relative">
        <Icon name="heroicons:magnifying-glass" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search tasks..."
          class="w-48 pl-8 pr-3 py-1.5 text-sm border border-slate-200 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/30"
        />
      </div>
      
      <!-- Status filter -->
      <select
        v-model="statusFilter"
        multiple
        class="hidden"
      />
      <div class="relative group">
        <button 
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors"
          :class="statusFilter.length ? 'border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/[0.08]'"
        >
          Status
          <span v-if="statusFilter.length" class="bg-blue-200 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 px-1 rounded text-[10px]">{{ statusFilter.length }}</span>
          <Icon name="heroicons:chevron-down" class="w-3 h-3" />
        </button>
        <div class="absolute top-full left-0 mt-1 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.06] rounded-lg shadow-lg py-1 z-20 hidden group-hover:block min-w-[140px]">
          <label
            v-for="status in availableStatuses"
            :key="status"
            class="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
          >
            <input
              type="checkbox"
              :value="status"
              v-model="statusFilter"
              class="rounded border-slate-300 dark:border-white/[0.08] text-blue-500 focus:ring-blue-200"
            />
            <span 
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
              :class="STATUS_CONFIG[status]?.color"
            >
              {{ STATUS_CONFIG[status]?.label }}
            </span>
          </label>
        </div>
      </div>
      
      <!-- Category filter -->
      <div v-if="availableCategories.length" class="relative group">
        <button 
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors"
          :class="categoryFilter.length ? 'border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/[0.08]'"
        >
          Category
          <span v-if="categoryFilter.length" class="bg-blue-200 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 px-1 rounded text-[10px]">{{ categoryFilter.length }}</span>
          <Icon name="heroicons:chevron-down" class="w-3 h-3" />
        </button>
        <div class="absolute top-full left-0 mt-1 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.06] rounded-lg shadow-lg py-1 z-20 hidden group-hover:block min-w-[140px]">
          <label
            v-for="cat in availableCategories"
            :key="cat"
            class="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
          >
            <input
              type="checkbox"
              :value="cat"
              v-model="categoryFilter"
              class="rounded border-slate-300 dark:border-white/[0.08] text-blue-500 focus:ring-blue-200"
            />
            <div class="w-2 h-2 rounded-full" :class="categoryDotColors[cat] || 'bg-slate-400 dark:bg-zinc-500'" />
            {{ cat }}
          </label>
        </div>
      </div>
      
      <!-- Risk filter -->
      <div class="relative group">
        <button 
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg transition-colors"
          :class="riskFilter.length ? 'border-blue-300 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/[0.08]'"
        >
          Risk
          <span v-if="riskFilter.length" class="bg-blue-200 dark:bg-blue-500/20 text-blue-800 dark:text-blue-300 px-1 rounded text-[10px]">{{ riskFilter.length }}</span>
          <Icon name="heroicons:chevron-down" class="w-3 h-3" />
        </button>
        <div class="absolute top-full left-0 mt-1 bg-white dark:bg-dm-card border border-slate-200 dark:border-white/[0.06] rounded-lg shadow-lg py-1 z-20 hidden group-hover:block min-w-[120px]">
          <label class="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer">
            <input type="checkbox" value="high" v-model="riskFilter" class="rounded border-slate-300 dark:border-white/[0.08] text-blue-500" />
            🔴 High
          </label>
          <label class="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer">
            <input type="checkbox" value="medium" v-model="riskFilter" class="rounded border-slate-300 dark:border-white/[0.08] text-blue-500" />
            🟡 Medium
          </label>
          <label class="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer">
            <input type="checkbox" value="low" v-model="riskFilter" class="rounded border-slate-300 dark:border-white/[0.08] text-blue-500" />
            🟢 Low
          </label>
        </div>
      </div>
      
      <!-- Spacer -->
      <div class="flex-1" />
      
      <!-- Smart Presets -->
      <div class="flex items-center gap-1">
        <button
          @click="applyPreset('needs-attention')"
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="activePreset === 'needs-attention' ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
        >
          🔥 Needs Attention
        </button>
        <button
          @click="applyPreset('at-risk')"
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="activePreset === 'at-risk' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
        >
          ⚠️ At Risk
        </button>
        <button
          @click="applyPreset('due-this-week')"
          class="px-2 py-1 text-xs rounded transition-colors"
          :class="activePreset === 'due-this-week' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400' : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'"
        >
          📅 Due This Week
        </button>
      </div>
      
      <!-- Clear filters -->
      <button
        v-if="hasActiveFilters"
        @click="clearFilters"
        class="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded transition-colors"
      >
        <Icon name="heroicons:x-mark" class="w-3 h-3" />
        Clear
      </button>
    </div>
    
    <!-- Table Header -->
    <div class="flex flex-shrink-0 border-b border-slate-200 dark:border-white/[0.06]">
      <!-- Sticky task column header -->
      <div class="w-52 lg:w-80 flex-shrink-0 px-4 py-2 border-r border-slate-100 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.04]">
        <button data-sort-btn @click="toggleSort('title')" class="text-left flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wide hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
          Task
          <Icon v-if="sortColumn === 'title'" :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-3 h-3" />
        </button>
      </div>
      <!-- Scrollable columns header (drag to scroll) -->
      <div
        ref="headerScrollRef"
        class="flex-1 overflow-x-auto scrollbar-hide cursor-grab select-none"
        @scroll="syncHeaderScroll"
        @pointerdown="onHeaderPointerDown"
        @pointermove="onHeaderPointerMove"
        @pointerup="onHeaderPointerUp"
        @pointercancel="onHeaderPointerUp"
      >
        <div class="flex items-center bg-slate-50 dark:bg-white/[0.04] py-2 text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wide" style="min-width: 1060px;">
          <div class="w-[100px] flex-shrink-0 px-2">
            <button data-sort-btn @click="toggleSort('status')" class="text-left flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
              Status
              <Icon v-if="sortColumn === 'status'" :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-3 h-3" />
            </button>
          </div>
          <div class="w-[80px] flex-shrink-0 px-2 text-left">Stage</div>
          <div class="w-[120px] flex-shrink-0 px-2">
            <button data-sort-btn @click="toggleSort('progress')" class="text-left flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
              Progress
              <Icon v-if="sortColumn === 'progress'" :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-3 h-3" />
            </button>
          </div>
          <div class="w-[80px] flex-shrink-0 px-2">
            <button data-sort-btn @click="toggleSort('confidence')" class="text-left flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
              Conf.
              <Icon v-if="sortColumn === 'confidence'" :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-3 h-3" />
            </button>
          </div>
          <div class="w-[130px] flex-shrink-0 px-2">Est. Completion</div>
          <div class="w-[90px] flex-shrink-0 px-2">
            <button data-sort-btn @click="toggleSort('dueDate')" class="text-left flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
              Due
              <Icon v-if="sortColumn === 'dueDate'" :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-3 h-3" />
            </button>
          </div>
          <div class="w-[90px] flex-shrink-0 px-2">
            <button data-sort-btn @click="toggleSort('priority')" class="text-left flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
              Priority
              <Icon v-if="sortColumn === 'priority'" :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-3 h-3" />
            </button>
          </div>
          <div class="w-[50px] flex-shrink-0 px-2">
            <button data-sort-btn @click="toggleSort('risk')" class="text-left flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
              Risk
              <Icon v-if="sortColumn === 'risk'" :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-3 h-3" />
            </button>
          </div>
          <div class="w-[110px] flex-shrink-0 px-2">
            <button data-sort-btn @click="toggleSort('assignee')" class="text-left flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors" title="Task Owner">
              Owner
              <Icon v-if="sortColumn === 'assignee'" :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-3 h-3" />
            </button>
          </div>
          <div class="w-[100px] flex-shrink-0 px-2">
            <button data-sort-btn @click="toggleSort('category')" class="text-left flex items-center gap-1 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
              Category
              <Icon v-if="sortColumn === 'category'" :name="sortDirection === 'asc' ? 'heroicons:chevron-up' : 'heroicons:chevron-down'" class="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Table Body -->
    <div class="flex-1 overflow-y-auto">
      <div class="flex min-h-full">
        <!-- Sticky task name column -->
        <div class="w-52 lg:w-80 flex-shrink-0 border-r border-slate-100 dark:border-white/[0.06] bg-white dark:bg-dm-card sticky left-0 z-10">
          <div
            v-for="item in flattenedItems"
            :key="item.id + '-label'"
            class="flex items-center gap-2 min-w-0 px-3 h-10 border-b border-slate-50 dark:border-white/[0.04] hover:bg-slate-50/80 dark:hover:bg-white/[0.04] cursor-pointer transition-colors group"
            :class="[
              item.status === 'done' ? 'opacity-60' : '',
              item.status === 'blocked' ? 'border-l-2 border-l-rose-400' : '',
            ]"
            :style="{ paddingLeft: `${12 + item.depth * 24}px` }"
            @click="handleRowClick(item)"
          >
            <!-- Expand/collapse button or spacer -->
            <button
              v-if="item.hasChildren"
              @click="toggleExpand(item.id, $event)"
              class="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Icon
                name="heroicons:chevron-right"
                class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 transition-transform duration-200"
                :class="item.isExpanded ? 'rotate-90' : ''"
              />
            </button>
            <div v-else class="w-5 flex-shrink-0" />

            <!-- Icon -->
            <Icon
              :name="getDepthIcon(item.depth, isRootLevel && item.depth === 0)"
              class="w-4 h-4 flex-shrink-0"
              :class="getDepthIconColor(item.depth, isRootLevel && item.depth === 0)"
            />

            <!-- Title -->
            <span
              class="truncate text-sm"
              :class="[
                item.status === 'done' ? 'text-slate-400 dark:text-zinc-500 line-through' : 'text-slate-800 dark:text-zinc-200',
                item.depth === 0 ? 'font-medium' : 'font-normal'
              ]"
            >
              {{ item.title }}
            </span>

            <!-- Children count badge -->
            <span
              v-if="item.hasChildren && !item.isExpanded"
              class="flex-shrink-0 text-[10px] text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-white/[0.08] px-1.5 py-0.5 rounded"
            >
              {{ item.childrenCount || item.children?.length || 0 }}
            </span>
          </div>
        </div>

        <!-- Scrollable data columns -->
        <div
          ref="bodyScrollRef"
          class="flex-1 overflow-x-auto"
          @scroll="syncBodyScroll"
        >
          <div style="min-width: 1060px;">
            <div
              v-for="item in flattenedItems"
              :key="item.id"
              class="flex items-center h-10 border-b border-slate-50 dark:border-white/[0.04] hover:bg-slate-50/80 dark:hover:bg-white/[0.04] cursor-pointer transition-colors group"
              :class="[
                item.status === 'done' ? 'opacity-60' : '',
              ]"
              @click="handleRowClick(item)"
            >
              <!-- Status -->
              <div class="w-[100px] flex-shrink-0 px-2 flex items-center">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
                  :class="STATUS_CONFIG[item.status]?.color || 'bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-zinc-400'"
                >
                  {{ STATUS_CONFIG[item.status]?.label || item.status }}
                </span>
              </div>

              <!-- Stage (subStatus) -->
              <div class="w-[80px] flex-shrink-0 px-2 flex items-center">
                <span
                  v-if="item.subStatus && SUB_STATUS_CONFIG[item.subStatus]"
                  class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
                  :class="SUB_STATUS_CONFIG[item.subStatus]?.color || 'bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-zinc-400'"
                >
                  {{ SUB_STATUS_CONFIG[item.subStatus]?.label || item.subStatus }}
                </span>
                <span v-else class="text-xs text-slate-300 dark:text-zinc-600">—</span>
              </div>

              <!-- Progress -->
              <div class="w-[120px] flex-shrink-0 px-2 flex items-center gap-2">
                <div class="flex-1 h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="[
                      item.progress >= 80 ? 'bg-emerald-400' :
                      item.progress >= 50 ? 'bg-blue-400' :
                      item.progress >= 25 ? 'bg-amber-400' : 'bg-slate-300 dark:bg-zinc-600'
                    ]"
                    :style="{ width: `${item.progress || 0}%` }"
                  />
                </div>
                <span class="text-xs text-slate-500 dark:text-zinc-400 w-8 text-right">{{ item.progress || 0 }}%</span>
              </div>

              <!-- Confidence -->
              <div class="w-[80px] flex-shrink-0 px-2 flex items-center gap-1">
                <span
                  class="text-xs"
                  :class="[
                    (item.confidence ?? 70) >= 67 ? 'text-emerald-500' :
                    (item.confidence ?? 70) >= 34 ? 'text-amber-500' : 'text-rose-500'
                  ]"
                >
                  {{ (item.confidence ?? 70) >= 67 ? '●●●' : (item.confidence ?? 70) >= 34 ? '●●○' : '●○○' }}
                </span>
                <span class="text-[10px] text-slate-400 dark:text-zinc-500">{{ item.confidence ?? 70 }}%</span>
              </div>

              <!-- Est. Completion -->
              <div class="w-[130px] flex-shrink-0 px-2 flex items-center text-xs" :class="item.needsEstimate ? 'text-slate-400 dark:text-zinc-500' : 'text-slate-600 dark:text-zinc-400'">
                {{ item.needsEstimate ? 'Needs estimate' : formatDateRange(getEstimatedCompletion(item)) }}
              </div>

              <!-- Due Date -->
              <div
                class="w-[90px] flex-shrink-0 px-2 flex items-center text-xs"
                :class="[
                  item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'done'
                    ? 'text-rose-500 font-medium'
                    : 'text-slate-600 dark:text-zinc-400'
                ]"
              >
                {{ formatDate(item.dueDate) }}
              </div>

              <!-- Priority -->
              <div class="w-[90px] flex-shrink-0 px-2 flex items-center gap-1.5">
                <div
                  class="w-2 h-2 rounded-full flex-shrink-0"
                  :class="priorityDotColors[item.priority ?? 'MEDIUM'] || 'bg-slate-300 dark:bg-zinc-600'"
                />
                <span class="text-xs text-slate-600 dark:text-zinc-400 truncate">
                  {{ priorityLabelMap[item.priority ?? 'MEDIUM'] ?? 'Medium' }}
                </span>
              </div>

              <!-- Risk -->
              <div class="w-[50px] flex-shrink-0 px-2 flex items-center">
                <span
                  v-if="item.riskLevel"
                  class="text-sm"
                  :title="item.riskLevel === 'high' ? 'High risk' : item.riskLevel === 'medium' ? 'Medium risk' : 'Low risk'"
                >
                  {{ item.riskLevel === 'high' ? '🔴' : item.riskLevel === 'medium' ? '🟡' : '🟢' }}
                </span>
                <span v-else class="text-slate-300 dark:text-zinc-600">—</span>
              </div>

              <!-- Assignee -->
              <div class="w-[110px] flex-shrink-0 px-2 flex items-center gap-1.5">
                <template v-if="item.assignee">
                  <div class="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                    <span class="text-[9px] text-white font-medium">{{ item.assignee.name?.[0] || '?' }}</span>
                  </div>
                  <span class="text-xs text-slate-600 dark:text-zinc-400 truncate">{{ item.assignee.name?.split(' ')[0] }}</span>
                </template>
                <span v-else class="text-xs text-slate-300 dark:text-zinc-600">—</span>
              </div>

              <!-- Category -->
              <div class="w-[100px] flex-shrink-0 px-2 flex items-center gap-1.5">
                <template v-if="item.category">
                  <div
                    class="w-2 h-2 rounded-full flex-shrink-0"
                    :class="categoryDotColors[item.category] || 'bg-slate-400 dark:bg-zinc-500'"
                  />
                  <span class="text-xs text-slate-600 dark:text-zinc-400 truncate">{{ item.category }}</span>
                </template>
                <span v-else class="text-xs text-slate-300 dark:text-zinc-600">—</span>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div
            v-if="flattenedItems.length === 0"
            class="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-zinc-500"
          >
            <Icon :name="hasActiveFilters ? 'heroicons:funnel' : 'heroicons:clipboard-document-list'" class="w-12 h-12 mb-4 opacity-50" />
            <p class="text-sm">{{ hasActiveFilters ? 'No items match your filters' : 'No items to display' }}</p>
            <button
              v-if="hasActiveFilters"
              @click="clearFilters"
              class="mt-3 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>
    </div>
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
