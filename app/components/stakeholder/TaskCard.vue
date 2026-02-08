<script setup lang="ts">
interface Task {
  id: string
  title: string
  status: string
  subStatus?: string | null
  progress: number
  confidence?: number
  startDate?: string | null
  dueDate?: string | null
  childrenCount?: number
  completedChildrenCount?: number
  children?: Task[]
}

const props = defineProps<{
  task: Task
  depth?: number
  index?: number
}>()

const depth = computed(() => props.depth ?? 0)
const isExpanded = ref(false) // Collapsed by default
const hasChildren = computed(() => (props.task.children?.length ?? 0) > 0 || (props.task.childrenCount ?? 0) > 0)

// Calculate estimated completion date range
const estimatedCompletion = computed(() => {
  const progress = props.task.progress ?? 0
  const confidence = props.task.confidence ?? 70
  const startDate = props.task.startDate
  
  if (!startDate || progress === 0) return null
  
  const start = new Date(startDate)
  const now = new Date()
  const daysSpent = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  
  if (progress >= 100) return { complete: true }
  
  // Estimate total days based on current velocity
  const totalEstimate = Math.round(daysSpent / (progress / 100))
  const remainingDays = Math.max(1, totalEstimate - daysSpent)
  
  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() + remainingDays)
  
  // Calculate uncertainty band based on confidence
  const bandDays = Math.ceil(remainingDays * (1 - confidence / 100) * 2)
  
  const earliest = new Date(baseDate)
  earliest.setDate(earliest.getDate() - Math.floor(bandDays / 2))
  const latest = new Date(baseDate)
  latest.setDate(latest.getDate() + Math.ceil(bandDays / 2))
  
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  
  // Calculate relative time
  const diffDays = Math.ceil((baseDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  let relative = ''
  if (diffDays <= 0) relative = 'Due soon'
  else if (diffDays === 1) relative = 'Due tomorrow'
  else if (diffDays < 7) relative = `Due in ${diffDays} days`
  else if (diffDays < 14) relative = 'Due in ~1 week'
  else if (diffDays < 21) relative = 'Due in ~2 weeks'
  else if (diffDays < 35) relative = 'Due in ~1 month'
  else relative = `Due in ~${Math.round(diffDays / 30)} months`
  
  return {
    complete: false,
    earliest: formatDate(earliest),
    latest: formatDate(latest),
    isExact: confidence >= 90,
    baseDate: formatDate(baseDate),
    relative,
    remainingDays: diffDays,
  }
})

// Status colors
const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  todo: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'To Do' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-600', label: 'In Progress' },
  blocked: { bg: 'bg-rose-50', text: 'text-rose-600', label: 'Blocked' },
  paused: { bg: 'bg-amber-50', text: 'text-amber-600', label: 'Paused' },
  done: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: 'Done' },
}

const statusStyle = computed(() => {
  const status = props.task.status.toLowerCase()
  return statusConfig[status] || statusConfig.todo
})

// Progress bar color
const progressColor = computed(() => {
  const p = props.task.progress ?? 0
  if (p >= 80) return 'bg-emerald-500'
  if (p >= 50) return 'bg-violet-500'
  if (p >= 25) return 'bg-blue-500'
  return 'bg-slate-300'
})

// Subtasks summary
const subtasksSummary = computed(() => {
  const total = props.task.childrenCount ?? props.task.children?.length ?? 0
  const completed = props.task.completedChildrenCount ?? 0
  if (total === 0) return null
  return { completed, total }
})

// Toggle expansion
const toggleExpand = () => {
  if (hasChildren.value) {
    isExpanded.value = !isExpanded.value
  }
}
</script>

<template>
  <div 
    class="group animate-fade-in-up"
    :style="{ animationDelay: `${(index ?? 0) * 50}ms` }"
  >
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
        class="absolute -left-6 top-0 bottom-1/2 w-6 border-l-2 border-b-2 border-slate-200 rounded-bl-xl"
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
              
              <!-- Status badge -->
              <span :class="[
                'flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-full',
                statusStyle.bg,
                statusStyle.text
              ]">
                {{ statusStyle.label }}
              </span>
            </div>
            
            <!-- Metrics row -->
            <div class="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3">
              <!-- Progress bar -->
              <div class="flex items-center gap-2 min-w-[120px]">
                <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    :class="[progressColor, 'h-full rounded-full transition-all duration-500']"
                    :style="{ width: `${task.progress}%` }"
                  />
                </div>
                <span class="text-xs font-medium text-slate-500 w-8">{{ task.progress }}%</span>
              </div>
              
              <!-- Estimated completion -->
              <div v-if="estimatedCompletion && !estimatedCompletion.complete" class="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon name="heroicons:calendar" class="w-3.5 h-3.5 text-slate-400" />
                <span class="font-medium">
                  {{ estimatedCompletion.isExact 
                    ? estimatedCompletion.baseDate 
                    : `${estimatedCompletion.earliest} – ${estimatedCompletion.latest}` 
                  }}
                </span>
                <span class="text-slate-400">({{ estimatedCompletion.relative }})</span>
              </div>
              
              <!-- Confidence indicator -->
              <div v-if="task.confidence" class="flex items-center gap-1.5 text-xs text-slate-500">
                <div class="flex gap-0.5">
                  <div 
                    v-for="i in 3" 
                    :key="i"
                    :class="[
                      'w-1.5 h-3 rounded-sm transition-colors',
                      i <= Math.ceil(task.confidence / 33) 
                        ? task.confidence >= 67 ? 'bg-emerald-400' : task.confidence >= 34 ? 'bg-amber-400' : 'bg-rose-400'
                        : 'bg-slate-200'
                    ]"
                  />
                </div>
                <span class="text-slate-400">{{ task.confidence }}% confident</span>
              </div>
              
              <!-- Subtasks count -->
              <div v-if="subtasksSummary" class="flex items-center gap-1.5 text-xs">
                <Icon name="heroicons:square-3-stack-3d" class="w-3.5 h-3.5 text-slate-400" />
                <span class="text-slate-500">
                  <span class="font-medium text-slate-700">{{ subtasksSummary.completed }}</span>
                  <span class="text-slate-400"> of </span>
                  <span class="font-medium text-slate-700">{{ subtasksSummary.total }}</span>
                  <span class="text-slate-400"> subtasks</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Nested children -->
    <TransitionGroup
      v-if="hasChildren && task.children"
      tag="div"
      name="list"
      class="mt-2 space-y-2"
    >
      <template v-if="isExpanded">
        <StakeholderTaskCard
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
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out forwards;
  opacity: 0;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.list-move {
  transition: transform 0.3s ease;
}
</style>
