<script setup lang="ts">
import type { ItemNode, Item } from '~/types'
import { STATUS_CONFIG, SUB_STATUS_CONFIG, SUB_STATUS_BY_STATUS, getSubStatusesForStatus } from '~/types'

const props = defineProps<{
  items: ItemNode[]
}>()

const emit = defineEmits<{
  itemClick: [item: ItemNode]
  drillDown: [item: ItemNode]
  openDetail: [item: ItemNode]
  statusChange: [itemId: string, newStatus: string, newSubStatus?: string | null]
  parentChange: [itemId: string, newParentId: string]
  openAttention: [item: ItemNode, mode: 'at-risk' | 'blocked']
  requestComplete: [item: ItemNode]
  openDocs: [item: ItemNode]
}>()

const columns: Item['status'][] = ['todo', 'in_progress', 'blocked', 'done']

// Subtle column styling
const columnStyles: Record<Item['status'], { bg: string; headerColor: string; dropBg: string }> = {
  todo: { bg: 'bg-slate-100 dark:bg-white/[0.01]', headerColor: 'text-slate-600 dark:text-zinc-400', dropBg: 'bg-slate-200 dark:bg-white/[0.06]' },
  in_progress: { bg: 'bg-blue-100/50 dark:bg-white/[0.01]', headerColor: 'text-blue-600 dark:text-blue-400', dropBg: 'bg-blue-200 dark:bg-white/[0.06]' },
  blocked: { bg: 'bg-rose-100/50 dark:bg-white/[0.01]', headerColor: 'text-rose-600 dark:text-rose-400', dropBg: 'bg-rose-200 dark:bg-white/[0.06]' },
  paused: { bg: 'bg-amber-100/50 dark:bg-white/[0.01]', headerColor: 'text-amber-600 dark:text-amber-400', dropBg: 'bg-amber-200 dark:bg-white/[0.06]' },
  done: { bg: 'bg-emerald-100/50 dark:bg-white/[0.01]', headerColor: 'text-emerald-600 dark:text-emerald-400', dropBg: 'bg-emerald-200 dark:bg-white/[0.06]' },
}

// Track collapsed state for each section (key: "status:subStatus" or "done:timeGroup")
const collapsedSections = ref<Set<string>>(new Set([
  'done:last_month',
  'done:all_time'
]))

const toggleSection = (sectionKey: string) => {
  if (collapsedSections.value.has(sectionKey)) {
    collapsedSections.value.delete(sectionKey)
  } else {
    collapsedSections.value.add(sectionKey)
  }
  collapsedSections.value = new Set(collapsedSections.value)
}

const isSectionCollapsed = (sectionKey: string) => {
  return collapsedSections.value.has(sectionKey)
}

const getItemsByStatus = (status: Item['status']) => {
  // Paused items appear in the "In Progress" column with a visual indicator
  if (status === 'in_progress') {
    return props.items.filter(item => item.status === 'in_progress' || item.status === 'paused')
  }
  return props.items.filter(item => item.status === status)
}

// Time-based grouping for DONE items
const getDoneItemsByTimeGroup = () => {
  const doneItems = getItemsByStatus('done')
  const now = new Date()
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  const groups: { key: string; label: string; icon: string; items: ItemNode[]; defaultCollapsed: boolean }[] = []
  
  const lastWeekItems = doneItems.filter(item => {
    const completedDate = new Date(item.updatedAt || item.createdAt)
    return completedDate >= oneWeekAgo
  })
  
  const lastMonthItems = doneItems.filter(item => {
    const completedDate = new Date(item.updatedAt || item.createdAt)
    return completedDate >= oneMonthAgo && completedDate < oneWeekAgo
  })
  
  const olderItems = doneItems.filter(item => {
    const completedDate = new Date(item.updatedAt || item.createdAt)
    return completedDate < oneMonthAgo
  })
  
  if (lastWeekItems.length > 0) {
    groups.push({
      key: 'last_week',
      label: 'Last 7 days',
      icon: 'heroicons:calendar',
      items: lastWeekItems,
      defaultCollapsed: false
    })
  }
  
  if (lastMonthItems.length > 0) {
    groups.push({
      key: 'last_month',
      label: 'Last 30 days',
      icon: 'heroicons:calendar-days',
      items: lastMonthItems,
      defaultCollapsed: true
    })
  }
  
  if (olderItems.length > 0) {
    groups.push({
      key: 'all_time',
      label: 'Older',
      icon: 'heroicons:archive-box',
      items: olderItems,
      defaultCollapsed: true
    })
  }
  
  return groups
}

// Group items by sub-status within a column (for non-done columns)
const getItemsGroupedBySubStatus = (status: Item['status']) => {
  const items = getItemsByStatus(status)
  const baseSubStatuses = getSubStatusesForStatus(status)
  const mergedSubStatuses = status === 'in_progress'
    ? { ...baseSubStatuses, ...getSubStatusesForStatus('paused') }
    : baseSubStatuses
  const subStatusKeys = Object.keys(mergedSubStatuses)
  
  if (subStatusKeys.length === 0) {
    // No sub-statuses for this status, return all items in default group
    return [{ subStatus: null, label: null, icon: null, items, sectionKey: `${status}:default` }]
  }
  
  // Group items by sub-status
  const groups: { subStatus: string | null; label: string | null; icon: string | null; items: ItemNode[]; sectionKey: string }[] = []
  
  // First, items without sub-status (default group)
  const defaultItems = items.filter(i => !i.subStatus || !subStatusKeys.includes(i.subStatus))
  if (defaultItems.length > 0) {
    groups.push({ subStatus: null, label: 'Unsorted', icon: 'heroicons:inbox-stack', items: defaultItems, sectionKey: `${status}:default` })
  }
  
  // Then, items with sub-status (sorted by order)
  const sortedSubStatuses = subStatusKeys.sort((a, b) => {
    const configA = mergedSubStatuses[a as keyof typeof mergedSubStatuses]
    const configB = mergedSubStatuses[b as keyof typeof mergedSubStatuses]
    return (configA?.order ?? 99) - (configB?.order ?? 99)
  })
  
  for (const ss of sortedSubStatuses) {
    const subStatusItems = items.filter(i => i.subStatus === ss)
    if (subStatusItems.length > 0) {
      const config = mergedSubStatuses[ss as keyof typeof mergedSubStatuses]
      groups.push({
        subStatus: ss,
        label: config?.label ?? ss,
        icon: config?.icon ?? null,
        items: subStatusItems,
        sectionKey: `${status}:${ss}`
      })
    }
  }
  
  return groups
}

// Resolve the actual status for a sub-status (e.g. 'on_hold' → 'paused')
const pausedSubStatuses = new Set(Object.keys(getSubStatusesForStatus('paused')))
const resolveStatusForSubStatus = (columnStatus: string, subStatus: string | null | undefined): string => {
  if (columnStatus === 'in_progress' && subStatus && pausedSubStatuses.has(subStatus)) {
    return 'paused'
  }
  return columnStatus
}

// Check if a column has multiple groups (for showing headers)
const hasMultipleGroups = (status: Item['status']) => {
  if (status === 'done') {
    return getDoneItemsByTimeGroup().length > 1
  }
  return getItemsGroupedBySubStatus(status).length > 1
}

// Collapse all / Expand all for a column
const collapseAllInColumn = (status: Item['status']) => {
  if (status === 'done') {
    for (const group of getDoneItemsByTimeGroup()) {
      collapsedSections.value.add(`done:${group.key}`)
    }
  } else {
    for (const group of getItemsGroupedBySubStatus(status)) {
      collapsedSections.value.add(group.sectionKey)
    }
  }
  collapsedSections.value = new Set(collapsedSections.value)
}

const expandAllInColumn = (status: Item['status']) => {
  if (status === 'done') {
    for (const group of getDoneItemsByTimeGroup()) {
      collapsedSections.value.delete(`done:${group.key}`)
    }
  } else {
    for (const group of getItemsGroupedBySubStatus(status)) {
      collapsedSections.value.delete(group.sectionKey)
    }
  }
  collapsedSections.value = new Set(collapsedSections.value)
}

const isAllCollapsedInColumn = (status: Item['status']) => {
  const keys = status === 'done'
    ? getDoneItemsByTimeGroup().map(g => `done:${g.key}`)
    : getItemsGroupedBySubStatus(status).map(g => g.sectionKey)
  return keys.length > 0 && keys.every(k => collapsedSections.value.has(k))
}

// Drag and drop state
const draggedItem = ref<ItemNode | null>(null)
const dragOverColumn = ref<string | null>(null)
const dragOverSubStatus = ref<string | null>(null)
const dragOverCardId = ref<string | null>(null) // For card-on-card nesting

const handleDragStart = (e: DragEvent, item: ItemNode) => {
  draggedItem.value = item
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
  }
  setTimeout(() => {
    const target = e.target as HTMLElement
    target.style.opacity = '0.5'
  }, 0)
}

const handleDragEnd = (e: DragEvent) => {
  draggedItem.value = null
  dragOverColumn.value = null
  dragOverSubStatus.value = null
  dragOverCardId.value = null
  const target = e.target as HTMLElement
  target.style.opacity = '1'
}

const hasIncompleteChildren = (item: ItemNode) => {
  if ((item.childrenCount ?? 0) > 0 && (!item.children || item.children.length === 0)) {
    return true
  }
  const stack = [...(item.children ?? [])]
  while (stack.length) {
    const child = stack.pop()
    if (!child) continue
    if (child.status !== 'done') return true
    if (child.children?.length) stack.push(...child.children)
  }
  return false
}

const handleDragOver = (e: DragEvent, status: string, subStatus?: string | null) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverColumn.value = status
  if (subStatus !== undefined) {
    dragOverSubStatus.value = subStatus ?? null
  }
}

const handleDragLeave = (e: DragEvent) => {
  const relatedTarget = e.relatedTarget as HTMLElement
  if (!relatedTarget || !relatedTarget.closest('[data-column]')) {
    dragOverColumn.value = null
    dragOverSubStatus.value = null
  }
}

const handleDrop = (e: DragEvent, targetStatus: string, targetSubStatus?: string | null) => {
  e.preventDefault()
  dragOverColumn.value = null
  dragOverSubStatus.value = null

  // Don't handle column drop if we're dropping on a card
  if (dragOverCardId.value) return

  if (draggedItem.value) {
    const resolvedStatus = resolveStatusForSubStatus(targetStatus, targetSubStatus)

    if (resolvedStatus === 'done' && draggedItem.value.status !== 'done') {
      if (hasIncompleteChildren(draggedItem.value)) {
        emit('requestComplete', draggedItem.value)
        return
      }
    }
    const statusChanged = draggedItem.value.status !== resolvedStatus
    const subStatusChanged = draggedItem.value.subStatus !== targetSubStatus

    if (statusChanged || subStatusChanged) {
      emit('statusChange', draggedItem.value.id, resolvedStatus, targetSubStatus)
    }
  }
  draggedItem.value = null
}

// Card-on-card drag handlers for nesting
const handleCardDragOver = (e: DragEvent, targetItem: ItemNode) => {
  if (!draggedItem.value) return

  // Always update sub-status tracking so section highlights work
  dragOverColumn.value = targetItem.status
  dragOverSubStatus.value = targetItem.subStatus ?? null

  // Can only nest within same column
  if (draggedItem.value.status !== targetItem.status) return

  // Cannot drop on self
  if (draggedItem.value.id === targetItem.id) return

  e.preventDefault()
  e.stopPropagation()
  dragOverCardId.value = targetItem.id
}

const handleCardDragLeave = (e: DragEvent) => {
  // Only clear if we're actually leaving the card
  const relatedTarget = e.relatedTarget as HTMLElement
  if (!relatedTarget || !relatedTarget.closest('[data-card-id]')) {
    dragOverCardId.value = null
  }
}

const handleCardDrop = (e: DragEvent, targetItem: ItemNode) => {
  if (draggedItem.value && dragOverCardId.value === targetItem.id) {
    // Nesting: dragged item becomes child of target
    e.preventDefault()
    e.stopPropagation()
    emit('parentChange', draggedItem.value.id, targetItem.id)
    draggedItem.value = null
    dragOverCardId.value = null
    dragOverColumn.value = null
    dragOverSubStatus.value = null
  }
  // Otherwise let the event bubble to the container's drop handler
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 h-full">
    <div 
      v-for="status in columns" 
      :key="status"
      :data-column="status"
      :class="[
        'flex flex-col min-w-0 rounded-xl p-3 transition-colors duration-150',
        dragOverColumn === status && draggedItem && !(draggedItem.status === status || (status === 'in_progress' && draggedItem.status === 'paused'))
          ? columnStyles[status].dropBg + ' ring-2 ring-inset ring-slate-300 dark:ring-zinc-600'
          : columnStyles[status].bg
      ]"
      @dragover="handleDragOver($event, status)"
      @dragleave="handleDragLeave"
      @drop="handleDrop($event, status)"
    >
      <!-- Column header -->
      <div class="flex items-center justify-between mb-4 px-1">
        <div class="flex items-center gap-2">
          <h2 :class="['text-xs font-medium uppercase tracking-wider', columnStyles[status].headerColor]">
            {{ STATUS_CONFIG[status].label }}
          </h2>
          <span class="text-[10px] font-normal text-slate-400 bg-white/80 dark:bg-white/[0.06] dark:text-zinc-500 px-1.5 py-0.5 rounded">
            {{ getItemsByStatus(status).length }}
          </span>
        </div>
        <div class="flex items-center gap-0.5">
          <button
            v-if="isAllCollapsedInColumn(status)"
            @click="expandAllInColumn(status)"
            class="p-1 rounded text-slate-300 hover:text-slate-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            title="Expand all"
          >
            <Icon name="heroicons:bars-arrow-down" class="w-3.5 h-3.5" />
          </button>
          <button
            v-else
            @click="collapseAllInColumn(status)"
            class="p-1 rounded text-slate-300 hover:text-slate-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
            title="Collapse all"
          >
            <Icon name="heroicons:bars-arrow-up" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      <!-- DONE column: Time-based groups -->
      <template v-if="status === 'done'">
        <div class="flex flex-col gap-3 flex-1 min-h-[120px] overflow-y-auto">
          <template v-for="group in getDoneItemsByTimeGroup()" :key="group.key">
            <!-- Time group header (collapsible) -->
            <button 
              v-if="hasMultipleGroups('done')"
              class="flex items-center gap-2 px-2 py-1.5 bg-white/60 hover:bg-white/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.06] rounded-lg border border-white/80 dark:border-white/[0.06] transition-colors text-left w-full"
              @click="toggleSection(`done:${group.key}`)"
            >
              <Icon 
                name="heroicons:chevron-right" 
                class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" 
                :class="{ 'rotate-90': !isSectionCollapsed(`done:${group.key}`) }"
              />
              <Icon 
                :name="group.icon" 
                class="w-3.5 h-3.5 text-emerald-500" 
              />
              <span class="text-[11px] font-medium text-slate-600 dark:text-zinc-300 flex-1">{{ group.label }}</span>
              <span class="text-[10px] text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded">{{ group.items.length }}</span>
            </button>

            <!-- Items in this time group -->
            <div
              v-show="!isSectionCollapsed(`done:${group.key}`)"
              class="flex flex-col gap-2"
            >
              <div
                v-for="item in group.items"
                :key="item.id"
                :data-card-id="item.id"
                draggable="true"
                :class="[
                  'cursor-grab active:cursor-grabbing transition-all duration-150',
                  dragOverCardId === item.id ? 'ring-2 ring-emerald-400 ring-offset-2 rounded-xl' : ''
                ]"
                @dragstart="handleDragStart($event, item)"
                @dragend="handleDragEnd"
                @dragover="handleCardDragOver($event, item)"
                @dragleave="handleCardDragLeave"
                @drop="handleCardDrop($event, item)"
              >
                <ItemsItemCard
                  :item="item"
                  :class="{ 'opacity-50': draggedItem?.id === item.id }"
                  @click="emit('itemClick', item)"
                  @drill-down="emit('drillDown', item)"
                  @open-detail="emit('openDetail', item)"
                  @open-attention="(target, mode) => emit('openAttention', target, mode)"
                  @open-docs="(target) => emit('openDocs', target)"
                />
              </div>
            </div>
          </template>
          
          <!-- Empty state for Done -->
          <div 
            v-if="getItemsByStatus('done').length === 0"
            class="flex-1 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.06] flex items-center justify-center transition-colors"
            :class="{ 'border-slate-400 bg-slate-100/50 dark:border-white/[0.1] dark:bg-white/[0.04]': dragOverColumn === 'done' }"
          >
            <span class="text-xs text-slate-300 dark:text-zinc-600">
              {{ dragOverColumn === 'done' ? 'Drop here' : 'No items' }}
            </span>
          </div>
        </div>
      </template>
      
      <!-- Other columns: Sub-status groups -->
      <template v-else>
        <div class="flex flex-col gap-3 flex-1 min-h-[120px] overflow-y-auto">
          <template v-for="group in getItemsGroupedBySubStatus(status)" :key="group.sectionKey">
            <!-- Sub-status section header (collapsible, only if multiple groups) -->
            <button
              v-if="group.label"
              class="flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors text-left w-full"
              :class="dragOverColumn === status && dragOverSubStatus === group.subStatus && draggedItem && !(draggedItem.status === status && draggedItem.subStatus === group.subStatus)
                ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30 dark:ring-blue-500/20'
                : 'bg-white/60 hover:bg-white/80 border-white/80 dark:bg-white/[0.04] dark:hover:bg-white/[0.06] dark:border-white/[0.06]'"
              :data-substatus="group.subStatus"
              @click="toggleSection(group.sectionKey)"
              @dragover.stop="handleDragOver($event, status, group.subStatus)"
              @drop.stop="handleDrop($event, status, group.subStatus)"
            >
              <Icon 
                name="heroicons:chevron-right" 
                class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" 
                :class="{ 'rotate-90': !isSectionCollapsed(group.sectionKey) }"
              />
              <Icon 
                v-if="group.icon" 
                :name="group.icon" 
                class="w-3.5 h-3.5 text-slate-400" 
              />
              <span class="text-[11px] font-medium text-slate-500 dark:text-zinc-400 flex-1">{{ group.label }}</span>
              <span class="text-[10px] text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded">{{ group.items.length }}</span>
            </button>

            <!-- Items in this group -->
            <div
              v-show="!isSectionCollapsed(group.sectionKey)"
              class="flex flex-col gap-2 rounded-lg transition-colors"
              :class="dragOverColumn === status && dragOverSubStatus === group.subStatus && draggedItem && !(draggedItem.status === status && draggedItem.subStatus === group.subStatus)
                ? 'bg-blue-50/50 dark:bg-blue-500/[0.06]'
                : ''"
              :data-substatus="group.subStatus"
              @dragover.stop="handleDragOver($event, status, group.subStatus)"
              @drop.stop="handleDrop($event, status, group.subStatus)"
            >
              <div
                v-for="item in group.items"
                :key="item.id"
                :data-card-id="item.id"
                draggable="true"
                :class="[
                  'cursor-grab active:cursor-grabbing transition-all duration-150',
                  dragOverCardId === item.id ? 'ring-2 ring-emerald-400 ring-offset-2 rounded-xl' : ''
                ]"
                @dragstart="handleDragStart($event, item)"
                @dragend="handleDragEnd"
                @dragover="handleCardDragOver($event, item)"
                @dragleave="handleCardDragLeave"
                @drop="handleCardDrop($event, item)"
              >
                <ItemsItemCard
                  :item="item"
                  :class="{ 'opacity-50': draggedItem?.id === item.id }"
                  @click="emit('itemClick', item)"
                  @drill-down="emit('drillDown', item)"
                  @open-detail="emit('openDetail', item)"
                  @open-attention="(target, mode) => emit('openAttention', target, mode)"
                  @open-docs="(target) => emit('openDocs', target)"
                />
              </div>
            </div>
          </template>

          <!-- Drop zone / Empty state -->
          <div 
            v-if="getItemsByStatus(status).length === 0"
            class="flex-1 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.06] flex items-center justify-center transition-colors"
            :class="{ 'border-slate-400 bg-slate-100/50 dark:border-white/[0.1] dark:bg-white/[0.04]': dragOverColumn === status }"
          >
            <span class="text-xs text-slate-300 dark:text-zinc-600">
              {{ dragOverColumn === status ? 'Drop here' : 'No items' }}
            </span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
