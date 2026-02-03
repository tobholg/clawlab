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
}>()

const columns: Item['status'][] = ['todo', 'in_progress', 'blocked', 'done']

// Subtle column styling
const columnStyles: Record<Item['status'], { bg: string; headerColor: string; dropBg: string }> = {
  todo: { bg: 'bg-slate-100', headerColor: 'text-slate-600', dropBg: 'bg-slate-200' },
  in_progress: { bg: 'bg-blue-100/50', headerColor: 'text-blue-600', dropBg: 'bg-blue-200' },
  blocked: { bg: 'bg-rose-100/50', headerColor: 'text-rose-600', dropBg: 'bg-rose-200' },
  paused: { bg: 'bg-amber-100/50', headerColor: 'text-amber-600', dropBg: 'bg-amber-200' },
  done: { bg: 'bg-emerald-100/50', headerColor: 'text-emerald-600', dropBg: 'bg-emerald-200' },
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
  const subStatuses = getSubStatusesForStatus(status)
  const subStatusKeys = Object.keys(subStatuses)
  
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
    const configA = subStatuses[a as keyof typeof subStatuses]
    const configB = subStatuses[b as keyof typeof subStatuses]
    return (configA?.order ?? 99) - (configB?.order ?? 99)
  })
  
  for (const ss of sortedSubStatuses) {
    const subStatusItems = items.filter(i => i.subStatus === ss)
    if (subStatusItems.length > 0) {
      const config = subStatuses[ss as keyof typeof subStatuses]
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

// Check if a column has multiple groups (for showing headers)
const hasMultipleGroups = (status: Item['status']) => {
  if (status === 'done') {
    return getDoneItemsByTimeGroup().length > 1
  }
  return getItemsGroupedBySubStatus(status).length > 1
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

const handleDragOver = (e: DragEvent, status: string, subStatus?: string | null) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverColumn.value = status
  dragOverSubStatus.value = subStatus ?? null
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
    const statusChanged = draggedItem.value.status !== targetStatus
    const subStatusChanged = draggedItem.value.subStatus !== targetSubStatus

    if (statusChanged || subStatusChanged) {
      emit('statusChange', draggedItem.value.id, targetStatus, targetSubStatus)
    }
  }
  draggedItem.value = null
}

// Card-on-card drag handlers for nesting
const handleCardDragOver = (e: DragEvent, targetItem: ItemNode) => {
  if (!draggedItem.value) return

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
  e.preventDefault()
  e.stopPropagation()

  if (draggedItem.value && dragOverCardId.value === targetItem.id) {
    // Emit parent change - dragged item becomes child of target
    emit('parentChange', draggedItem.value.id, targetItem.id)
  }

  draggedItem.value = null
  dragOverCardId.value = null
  dragOverColumn.value = null
  dragOverSubStatus.value = null
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
        dragOverColumn === status && draggedItem?.status !== status
          ? columnStyles[status].dropBg + ' ring-2 ring-inset ring-slate-300'
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
          <span class="text-[10px] font-normal text-slate-400 bg-white/80 px-1.5 py-0.5 rounded">
            {{ getItemsByStatus(status).length }}
          </span>
        </div>
        <button class="opacity-0 group-hover:opacity-100 transition-opacity">
          <Icon name="heroicons:plus" class="w-4 h-4 text-slate-300 hover:text-slate-500" />
        </button>
      </div>
      
      <!-- DONE column: Time-based groups -->
      <template v-if="status === 'done'">
        <div class="flex flex-col gap-3 flex-1 min-h-[120px] overflow-y-auto">
          <template v-for="group in getDoneItemsByTimeGroup()" :key="group.key">
            <!-- Time group header (collapsible) -->
            <button 
              v-if="hasMultipleGroups('done')"
              class="flex items-center gap-2 px-2 py-1.5 bg-white/60 hover:bg-white/80 rounded-lg border border-white/80 transition-colors text-left w-full"
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
              <span class="text-[11px] font-medium text-slate-600 flex-1">{{ group.label }}</span>
              <span class="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{{ group.items.length }}</span>
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
                />
              </div>
            </div>
          </template>
          
          <!-- Empty state for Done -->
          <div 
            v-if="getItemsByStatus('done').length === 0"
            class="flex-1 rounded-xl border border-dashed border-slate-200 flex items-center justify-center transition-colors"
            :class="{ 'border-slate-400 bg-slate-100/50': dragOverColumn === 'done' }"
          >
            <span class="text-xs text-slate-300">
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
              v-if="group.label && hasMultipleGroups(status)"
              class="flex items-center gap-2 px-2 py-1.5 bg-white/60 hover:bg-white/80 rounded-lg border border-white/80 transition-colors text-left w-full"
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
              <span class="text-[11px] font-medium text-slate-500 flex-1">{{ group.label }}</span>
              <span class="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{{ group.items.length }}</span>
            </button>
            
            <!-- Items in this group -->
            <div 
              v-show="!isSectionCollapsed(group.sectionKey)"
              class="flex flex-col gap-2"
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
                />
              </div>
            </div>
          </template>

          <!-- Drop zone / Empty state -->
          <div 
            v-if="getItemsByStatus(status).length === 0"
            class="flex-1 rounded-xl border border-dashed border-slate-200 flex items-center justify-center transition-colors"
            :class="{ 'border-slate-400 bg-slate-100/50': dragOverColumn === status }"
          >
            <span class="text-xs text-slate-300">
              {{ dragOverColumn === status ? 'Drop here' : 'No items' }}
            </span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
