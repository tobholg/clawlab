<script setup lang="ts">
import type { ItemNode, Item } from '~/types'
import { STATUS_CONFIG } from '~/types'

const props = defineProps<{
  items: ItemNode[]
}>()

const emit = defineEmits<{
  itemClick: [item: ItemNode]
  drillDown: [item: ItemNode]
  openDetail: [item: ItemNode]
  statusChange: [itemId: string, newStatus: string]
}>()

const columns: Item['status'][] = ['todo', 'in_progress', 'blocked', 'done']

// Subtle column styling
const columnStyles: Record<Item['status'], { bg: string; headerColor: string; dropBg: string }> = {
  todo: { bg: 'bg-slate-100/60', headerColor: 'text-slate-500', dropBg: 'bg-slate-200/80' },
  in_progress: { bg: 'bg-blue-50/80', headerColor: 'text-blue-600', dropBg: 'bg-blue-100/80' },
  blocked: { bg: 'bg-rose-50/80', headerColor: 'text-rose-500', dropBg: 'bg-rose-100/80' },
  done: { bg: 'bg-emerald-50/80', headerColor: 'text-emerald-600', dropBg: 'bg-emerald-100/80' },
}

const getItemsByStatus = (status: Item['status']) => {
  return props.items.filter(item => item.status === status)
}

// Drag and drop state
const draggedItem = ref<ItemNode | null>(null)
const dragOverColumn = ref<string | null>(null)

const handleDragStart = (e: DragEvent, item: ItemNode) => {
  draggedItem.value = item
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
  }
  // Add visual feedback
  setTimeout(() => {
    const target = e.target as HTMLElement
    target.style.opacity = '0.5'
  }, 0)
}

const handleDragEnd = (e: DragEvent) => {
  draggedItem.value = null
  dragOverColumn.value = null
  const target = e.target as HTMLElement
  target.style.opacity = '1'
}

const handleDragOver = (e: DragEvent, status: string) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dragOverColumn.value = status
}

const handleDragLeave = (e: DragEvent) => {
  // Only clear if leaving the column entirely
  const relatedTarget = e.relatedTarget as HTMLElement
  if (!relatedTarget || !relatedTarget.closest('[data-column]')) {
    dragOverColumn.value = null
  }
}

const handleDrop = (e: DragEvent, targetStatus: string) => {
  e.preventDefault()
  dragOverColumn.value = null
  
  if (draggedItem.value && draggedItem.value.status !== targetStatus) {
    emit('statusChange', draggedItem.value.id, targetStatus)
  }
  draggedItem.value = null
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
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
      
      <!-- Cards -->
      <div class="flex flex-col gap-3 flex-1 min-h-[120px]">
        <div
          v-for="item in getItemsByStatus(status)"
          :key="item.id"
          draggable="true"
          class="cursor-grab active:cursor-grabbing"
          @dragstart="handleDragStart($event, item)"
          @dragend="handleDragEnd"
        >
          <ItemsItemCard
            :item="item"
            :class="{ 'opacity-50': draggedItem?.id === item.id }"
            @click="emit('itemClick', item)"
            @drill-down="emit('drillDown', item)"
            @open-detail="emit('openDetail', item)"
          />
        </div>
        
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
    </div>
  </div>
</template>
