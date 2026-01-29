<script setup lang="ts">
import type { ItemNode } from '~/types'

const props = defineProps<{
  item: ItemNode
}>()

const emit = defineEmits<{
  click: [item: ItemNode]
  drillDown: [item: ItemNode]
  openDetail: [item: ItemNode]
}>()

const { isFocusedOn } = useFocus()

const hasChildren = computed(() => props.item.childrenCount > 0)
const isCurrentlyFocused = computed(() => isFocusedOn(props.item.id))

// Avatar colors (deterministic based on id)
const avatarColors = [
  'bg-blue-500',
  'bg-emerald-500', 
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-indigo-500',
]

const getAvatarColor = (id: string) => {
  const hash = (id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return avatarColors[hash % avatarColors.length]
}

const getInitials = (name: string) => {
  return (name || '').split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}

// Calculate estimated completion date range
const estimatedCompletion = computed(() => {
  const progress = props.item.progress ?? 0
  const confidence = props.item.confidence ?? 70
  const startDate = props.item.startDate
  
  if (!startDate || progress === 0) return null
  
  const start = new Date(startDate)
  const now = new Date()
  const daysSpent = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  
  if (progress >= 100) return { complete: true }
  
  const totalEstimate = Math.round(daysSpent / (progress / 100))
  const remainingDays = Math.max(1, totalEstimate - daysSpent)
  
  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() + remainingDays)
  
  const bandDays = Math.ceil(remainingDays * (1 - confidence / 100) * 2)
  
  const earliest = new Date(baseDate)
  earliest.setDate(earliest.getDate() - Math.floor(bandDays / 2))
  const latest = new Date(baseDate)
  latest.setDate(latest.getDate() + Math.ceil(bandDays / 2))
  
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  
  return {
    complete: false,
    earliest: formatDate(earliest),
    latest: formatDate(latest),
    isExact: confidence >= 95,
    baseDate: formatDate(baseDate),
  }
})

// Progress ring color
const progressColor = computed(() => {
  const p = props.item.progress ?? 0
  if (p >= 80) return 'text-emerald-400'
  if (p >= 50) return 'text-blue-400'
  if (p >= 25) return 'text-amber-400'
  return 'text-slate-300'
})

// Category dot color
const categoryDotColor = computed(() => {
  const colors: Record<string, string> = {
    'Engineering': 'bg-blue-500',
    'Design': 'bg-violet-500',
    'Marketing': 'bg-pink-500',
    'Product': 'bg-indigo-500',
    'Research': 'bg-cyan-500',
    'Operations': 'bg-orange-500',
    'Sales': 'bg-green-500',
  }
  return colors[props.item.category ?? ''] ?? 'bg-slate-300'
})

// Clicking the card opens the detail modal
const handleCardClick = () => {
  emit('openDetail', props.item)
}
</script>

<template>
  <div 
    class="group bg-white p-4 rounded-xl border transition-all duration-200 cursor-pointer"
    :class="isCurrentlyFocused 
      ? 'border-amber-300 ring-2 ring-amber-100 shadow-sm' 
      : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'"
    @click="handleCardClick"
  >
    <!-- Title row with category dot -->
    <div class="flex items-start gap-2 mb-2">
      <!-- Category color dot -->
      <div 
        class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
        :class="categoryDotColor"
        :title="item.category || 'No category'"
      />
      
      <!-- Title + Focus indicator -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <h3 class="text-sm font-medium text-slate-800 leading-snug truncate">
            {{ item.title }}
          </h3>
          <!-- Focus indicator (compact) -->
          <span v-if="isCurrentlyFocused" class="relative flex h-2 w-2 flex-shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <!-- Temperature indicator (compact) -->
          <span 
            v-if="item.temperature === 'hot' || item.temperature === 'critical'"
            class="text-xs flex-shrink-0"
            :title="item.temperature"
          >
            {{ item.temperature === 'critical' ? '🔥' : '🌡️' }}
          </span>
        </div>
      </div>
      
      <!-- Menu button -->
      <button class="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 -mr-1 -mt-0.5">
        <Icon name="heroicons:ellipsis-horizontal" class="w-4 h-4 text-slate-300 hover:text-slate-500" />
      </button>
    </div>
    
    <!-- Children indicator -->
    <button
      v-if="hasChildren"
      class="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-600 mb-3 transition-colors"
      @click.stop="emit('drillDown', item)"
    >
      <Icon name="heroicons:square-3-stack-3d" class="w-3 h-3" />
      <span>{{ item.childrenCount }} items</span>
      <span v-if="item.hotChildrenCount > 0" class="text-orange-500">
        · {{ item.hotChildrenCount }} hot
      </span>
      <span v-if="item.blockedChildrenCount > 0" class="text-rose-500">
        · {{ item.blockedChildrenCount }} blocked
      </span>
    </button>
    
    <!-- Footer -->
    <div class="flex items-center justify-between pt-3 border-t border-slate-50">
      <div class="flex items-center gap-1">
        <!-- Owner -->
        <div 
          v-if="item.owner"
          :class="[
            'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
            getAvatarColor(item.owner.id)
          ]"
          :title="`Owner: ${item.owner.name}`"
        >
          <span class="text-[9px] text-white font-medium">
            {{ getInitials(item.owner.name) }}
          </span>
        </div>
        
        <!-- Stakeholders -->
        <template v-if="item.stakeholders && item.stakeholders.length > 0">
          <div class="w-px h-3 bg-slate-200 mx-1" />
          <div class="flex -space-x-1">
            <div 
              v-for="person in item.stakeholders.slice(0, 2)" 
              :key="person.id"
              :class="[
                'w-5 h-5 rounded-full flex items-center justify-center border border-white flex-shrink-0',
                getAvatarColor(person.id)
              ]"
              :title="person.name"
            >
              <span class="text-[9px] text-white font-medium">
                {{ getInitials(person.name) }}
              </span>
            </div>
            <div 
              v-if="item.stakeholders.length > 2"
              class="w-5 h-5 rounded-full bg-slate-200 border border-white flex items-center justify-center flex-shrink-0"
            >
              <span class="text-[9px] text-slate-600 font-medium">+{{ item.stakeholders.length - 2 }}</span>
            </div>
          </div>
        </template>
      </div>
      
      <div class="flex items-center gap-2">
        <!-- Estimated completion date -->
        <span v-if="estimatedCompletion && !estimatedCompletion.complete" class="text-[10px] font-normal text-slate-400">
          {{ estimatedCompletion.isExact ? estimatedCompletion.baseDate : `${estimatedCompletion.earliest} – ${estimatedCompletion.latest}` }}
        </span>
        <span v-else-if="item.dueDate" class="text-[10px] font-normal text-slate-400">
          {{ new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
        </span>
        
        <!-- Progress Ring -->
        <div class="relative flex items-center justify-center w-6 h-6 group/progress cursor-help">
          <svg height="20" width="20" class="rotate-[-90deg]">
            <circle
              stroke="currentColor"
              fill="transparent"
              stroke-width="1.5"
              class="text-slate-100"
              r="8.5"
              cx="10"
              cy="10"
            />
            <circle
              stroke="currentColor"
              fill="transparent"
              stroke-width="1.5"
              :stroke-dasharray="53.4"
              :stroke-dashoffset="53.4 - ((item.progress ?? 0) / 100) * 53.4"
              :class="[progressColor, 'transition-all duration-500']"
              stroke-linecap="round"
              r="8.5"
              cx="10"
              cy="10"
            />
          </svg>
          <span class="absolute text-[8px] font-normal text-slate-400">
            {{ item.progress ?? 0 }}
          </span>
          <!-- Tooltip -->
          <div class="absolute bottom-full mb-2 hidden group-hover/progress:block bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20 pointer-events-none">
            Progress: how much of this task is complete
          </div>
        </div>
        
        <!-- Confidence Ring -->
        <UiConfidenceRing :percent="item.confidence" />
      </div>
    </div>
  </div>
</template>
