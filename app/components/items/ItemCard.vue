<script setup lang="ts">
import type { ItemNode } from '~/types'
import { getItemEstimateMeta } from '~/utils/itemRisk'

const props = defineProps<{
  item: ItemNode
}>()

const emit = defineEmits<{
  click: [item: ItemNode]
  drillDown: [item: ItemNode]
  openDetail: [item: ItemNode]
  openAttention: [item: ItemNode, mode: 'at-risk' | 'blocked']
  openDocs: [item: ItemNode]
}>()

const { isFocusedOnTask, startTaskFocus, focusState } = useFocus()

const hasChildren = computed(() => (props.item.childrenCount ?? 0) > 0)
const activeChildrenCount = computed(() => {
  if (typeof props.item.activeChildrenCount === 'number') return props.item.activeChildrenCount
  return props.item.childrenCount ?? 0
})
const allChildrenCompleted = computed(() => hasChildren.value && activeChildrenCount.value === 0)
const isCurrentlyFocused = computed(() => isFocusedOnTask(props.item.id))
const isPaused = computed(() => props.item.status === 'paused')
const showOwnerTooltip = ref(false)
const ownerAvatarRef = ref<HTMLElement | null>(null)
const tooltipPos = ref({ top: 0, left: 0 })

const onOwnerEnter = () => {
  if (ownerAvatarRef.value) {
    const rect = ownerAvatarRef.value.getBoundingClientRect()
    tooltipPos.value = {
      top: rect.top,
      left: rect.left + rect.width / 2,
    }
  }
  showOwnerTooltip.value = true
}
const onOwnerLeave = () => {
  showOwnerTooltip.value = false
}
const estimateMeta = computed(() => getItemEstimateMeta(props.item))
const needsEstimate = computed(() => estimateMeta.value.needsEstimate)

// Focus action
const handleFocusClick = async (e: Event) => {
  e.stopPropagation()
  await startTaskFocus(props.item.id)
}

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
    'Bug': 'bg-rose-500',
    'Design': 'bg-violet-500',
    'Product': 'bg-indigo-500',
    'QA': 'bg-amber-500',
    'Research': 'bg-cyan-500',
    'Operations': 'bg-orange-500',
    'Marketing': 'bg-pink-500',
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
    class="group p-4 rounded-xl border transition-all duration-200 cursor-pointer"
    :class="[
      isPaused
        ? 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.04] opacity-75'
        : 'bg-white dark:bg-white/[0.05]',
      isCurrentlyFocused
        ? 'border-amber-300 dark:border-amber-500/40 ring-2 ring-amber-100 dark:ring-amber-500/15 shadow-sm'
        : !isPaused && 'border-slate-100 dark:border-white/[0.06] hover:border-slate-200 dark:hover:border-white/[0.1] dark:hover:bg-white/[0.02] hover:shadow-sm'
    ]"
    @click="handleCardClick"
  >
    <!-- Title row with category dot -->
    <div class="flex items-start gap-2 mb-1">
      <!-- Category color dot -->
      <div 
        class="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
        :class="categoryDotColor"
        :title="item.category || 'No category'"
      />
      
      <!-- Title + Focus indicator -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <h3
            class="text-sm font-medium leading-snug truncate"
            :class="isPaused ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-800 dark:text-zinc-200'"
          >
            {{ item.title }}
          </h3>
          <!-- Paused badge -->
          <span
            v-if="isPaused"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-200 dark:bg-white/[0.08] text-slate-500 dark:text-zinc-500 rounded text-[10px] font-medium flex-shrink-0"
          >
            <Icon name="heroicons:pause" class="w-3 h-3" />
            Paused
          </span>
          <!-- Focus indicator (compact) -->
          <span v-else-if="isCurrentlyFocused" class="relative flex h-2 w-2 flex-shrink-0">
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
      
      <!-- Hover actions -->
      <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <!-- View full button -->
        <button
          @click.stop="emit('drillDown', item)"
          class="w-6 h-6 rounded flex items-center justify-center text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
          title="View full board"
        >
          <Icon name="heroicons:arrows-pointing-out" class="w-3.5 h-3.5" />
        </button>
        <!-- Focus button -->
        <button
          v-if="!isCurrentlyFocused"
          @click="handleFocusClick"
          class="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-50 dark:hover:bg-amber-900/30 text-slate-300 dark:text-zinc-600 hover:text-amber-500 transition-colors"
          title="Focus on this"
        >
          <Icon name="heroicons:bolt" class="w-4 h-4" />
        </button>
      </div>
    </div>
    
    <!-- Children indicator -->
    <div v-if="hasChildren" class="flex flex-wrap items-center gap-2 text-[10px] mb-1.5">
      <button
        class="flex items-center gap-1.5 transition-colors"
        :class="allChildrenCompleted ? 'text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300' : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300'"
        @click.stop="emit('drillDown', item)"
      >
        <Icon name="heroicons:square-3-stack-3d" class="w-3 h-3" />
        <span v-if="allChildrenCompleted">All items completed</span>
        <span v-else>{{ activeChildrenCount }} items</span>
      </button>
      <button
        v-if="(item.atRiskChildrenCount ?? 0) > 0"
        class="text-amber-600 hover:text-amber-700 transition-colors"
        @click.stop="emit('openAttention', item, 'at-risk')"
      >
        {{ item.atRiskChildrenCount }} at risk
      </button>
      <button
        v-if="(item.blockedChildrenCount ?? 0) > 0"
        class="text-rose-500 hover:text-rose-600 transition-colors"
        @click.stop="emit('openAttention', item, 'blocked')"
      >
        {{ item.blockedChildrenCount }} blocked
      </button>
      <button
        v-if="item.documentCount"
        class="flex items-center gap-1 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
        @click.stop="emit('openDocs', item)"
      >
        <Icon name="heroicons:document-text" class="w-3 h-3" />
        {{ item.documentCount }}
      </button>
    </div>

    <!-- Document indicator (when no children but has docs) -->
    <button
      v-else-if="item.documentCount"
      class="flex items-center gap-1 text-[10px] text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors mb-1.5"
      @click.stop="emit('openDocs', item)"
    >
      <Icon name="heroicons:document-text" class="w-3 h-3" />
      {{ item.documentCount }} {{ item.documentCount === 1 ? 'doc' : 'docs' }}
    </button>
    
    <!-- Footer -->
    <div class="flex items-center justify-between pt-2">
      <div class="flex items-center gap-1">
        <!-- Owner -->
        <div
          v-if="item.owner"
          ref="ownerAvatarRef"
          class="flex-shrink-0"
          @mouseenter="onOwnerEnter"
          @mouseleave="onOwnerLeave"
        >
          <div
            :class="[
              'w-5 h-5 rounded-full flex items-center justify-center',
              getAvatarColor(item.owner.id)
            ]"
          >
            <span class="text-[9px] text-white font-medium">
              {{ getInitials(item.owner.name) }}
            </span>
          </div>
        </div>
        
        <!-- Stakeholders -->
        <template v-if="item.stakeholders && item.stakeholders.length > 0">
          <div class="w-px h-3 bg-slate-200 dark:bg-white/[0.08] mx-1" />
          <div class="flex -space-x-1">
            <div 
              v-for="person in item.stakeholders.slice(0, 2)" 
              :key="person.id"
              :class="[
                'w-5 h-5 rounded-full flex items-center justify-center border border-white dark:border-dm-card flex-shrink-0',
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
              class="w-5 h-5 rounded-full bg-slate-200 dark:bg-white/[0.08] border border-white dark:border-dm-card flex items-center justify-center flex-shrink-0"
            >
              <span class="text-[9px] text-slate-600 dark:text-zinc-500 font-medium">+{{ item.stakeholders.length - 2 }}</span>
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
        <span v-if="needsEstimate" class="text-[10px] font-normal text-slate-400">
          • Needs estimate
        </span>
        
        <!-- Progress Ring -->
        <div class="relative flex items-center justify-center w-6 h-6" title="Progress: how much of this task is complete">
          <svg height="20" width="20" class="rotate-[-90deg]">
            <circle
              stroke="currentColor"
              fill="transparent"
              stroke-width="1.5"
              class="text-slate-100 dark:text-zinc-700"
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
        </div>
        
        <!-- Confidence Ring -->
        <UiConfidenceRing :percent="item.confidence" />
      </div>
    </div>
  </div>

  <!-- Owner tooltip (teleported to avoid overflow clipping) -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="showOwnerTooltip && item.owner"
        class="fixed z-[100] pointer-events-none -translate-x-1/2"
        :style="{ top: `${tooltipPos.top - 8}px`, left: `${tooltipPos.left}px`, transform: 'translate(-50%, -100%)' }"
      >
        <div class="flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-zinc-800 rounded-xl shadow-lg shadow-black/10 dark:shadow-black/50 border border-slate-200/80 dark:border-zinc-700 whitespace-nowrap">
          <div
            :class="[
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
              getAvatarColor(item.owner.id)
            ]"
          >
            <span class="text-[10px] text-white font-semibold">{{ getInitials(item.owner.name) }}</span>
          </div>
          <div class="min-w-0">
            <div class="text-[13px] font-medium text-slate-800 dark:text-zinc-100">{{ item.owner.name }}</div>
            <div v-if="item.owner.position" class="text-[11px] text-slate-500 dark:text-zinc-400">{{ item.owner.position }}</div>
            <div v-else class="text-[11px] text-slate-500 dark:text-zinc-400">Owner</div>
          </div>
        </div>
        <div class="flex justify-center -mt-px">
          <div class="w-2 h-2 bg-white dark:bg-zinc-800 border-b border-r border-slate-200/80 dark:border-zinc-700 rotate-45 -translate-y-1"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
