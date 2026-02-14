<script setup lang="ts">
interface CompletedTask {
  id: string
  title: string
  startDate: string | null
  completedAt: string | null
  durationDays: number | null
  childrenCount: number
  children: CompletedTask[]
}

const props = defineProps<{
  task: CompletedTask
  depth?: number
  index?: number
}>()

const depth = computed(() => props.depth ?? 0)
const isExpanded = ref(false)
const hasChildren = computed(() => props.task.children?.length > 0)

// Format duration in human-readable form
const formattedDuration = computed(() => {
  const days = props.task.durationDays
  if (days === null) return null
  
  if (days === 0) return 'Same day'
  if (days === 1) return '1 day'
  if (days < 7) return `${days} days`
  if (days < 14) return '1 week'
  if (days < 30) return `${Math.round(days / 7)} weeks`
  if (days < 60) return '1 month'
  if (days < 365) return `${Math.round(days / 30)} months`
  return `${(days / 365).toFixed(1)} years`
})

// Format completion date
const formattedCompletedAt = computed(() => {
  if (!props.task.completedAt) return null
  const date = new Date(props.task.completedAt)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined 
  })
})

// Format start date
const formattedStartDate = computed(() => {
  if (!props.task.startDate) return null
  const date = new Date(props.task.startDate)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined 
  })
})

// Toggle expansion
const toggleExpand = () => {
  if (hasChildren.value) {
    isExpanded.value = !isExpanded.value
  }
}
</script>

<template>
  <div class="group">
    <div
      :class="[
        'relative rounded-xl border transition-all duration-200',
        depth === 0 
          ? 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200' 
          : 'bg-slate-50/50 border-slate-100/50',
        depth > 0 ? 'ml-6' : ''
      ]"
    >
      <!-- Connection line for nested items -->
      <div 
        v-if="depth > 0" 
        class="absolute -left-6 top-0 bottom-1/2 w-6 border-l-2 border-b-2 border-emerald-200 rounded-bl-xl"
      />
      
      <div class="p-4">
        <!-- Header row -->
        <div class="flex items-start gap-3">
          <!-- Expand/collapse button for items with children -->
          <button
            v-if="hasChildren"
            @click.stop="toggleExpand"
            class="mt-0.5 w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all flex-shrink-0"
          >
            <Icon 
              :name="isExpanded ? 'heroicons:chevron-down' : 'heroicons:chevron-right'" 
              class="w-4 h-4 transition-transform"
            />
          </button>
          <div v-else class="w-5 flex-shrink-0" />
          
          <!-- Title and metadata -->
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-3">
              <h3 :class="[
                'font-medium leading-snug',
                depth === 0 ? 'text-slate-900' : 'text-slate-700 text-sm'
              ]">
                {{ task.title }}
              </h3>
              
              <!-- Done badge -->
              <span class="flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600">
                Done
              </span>
            </div>
            
            <!-- Metrics row -->
            <div class="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3">
              <!-- Green 100% progress bar -->
              <div class="flex items-center gap-2 min-w-[120px]">
                <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="bg-emerald-500 h-full rounded-full w-full" />
                </div>
                <span class="text-xs font-medium text-emerald-600 w-10">100%</span>
              </div>
              
              <!-- Completion date -->
              <div v-if="formattedCompletedAt" class="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon name="heroicons:check-circle" class="w-3.5 h-3.5 text-emerald-500" />
                <span class="font-medium">Completed {{ formattedCompletedAt }}</span>
              </div>
              
              <!-- Duration -->
              <div v-if="formattedDuration" class="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon name="heroicons:clock" class="w-3.5 h-3.5 text-slate-400" />
                <span>
                  <span v-if="formattedStartDate" class="text-slate-400">{{ formattedStartDate }} → </span>
                  <span class="font-medium text-slate-600">{{ formattedDuration }}</span>
                </span>
              </div>
              
              <!-- Subtasks count -->
              <div v-if="task.childrenCount > 0" class="flex items-center gap-1.5 text-xs">
                <Icon name="heroicons:square-3-stack-3d" class="w-3.5 h-3.5 text-emerald-400" />
                <span class="text-slate-500">
                  <span class="font-medium text-slate-700">{{ task.childrenCount }}</span>
                  <span class="text-slate-400"> subtask{{ task.childrenCount !== 1 ? 's' : '' }} completed</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Nested children -->
    <TransitionGroup
      v-if="hasChildren"
      tag="div"
      name="list"
      class="mt-2 space-y-2"
    >
      <template v-if="isExpanded">
        <StakeholderCompletedTaskCard
          v-for="(child, idx) in task.children"
          :key="child.id"
          :task="child"
          :depth="depth + 1"
          :index="idx"
        />
      </template>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.list-enter-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
