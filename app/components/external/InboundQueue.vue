<script setup lang="ts">
interface Submitter {
  displayName: string
  position?: string
}

interface ExternalComment {
  id: string
  authorName: string
  content: string
  isTeamMember: boolean
  createdAt: string
}

interface InboundTask {
  id: string
  type: 'task'
  spaceId: string
  spaceName: string
  title: string
  description: string
  status: string
  submitter: Submitter
  submittedAt: string
  internalNotes?: string
  linkedTaskId?: string
  rejectionReason?: string
  comments: ExternalComment[]
}

interface InboundIR {
  id: string
  type: 'question' | 'suggestion'
  spaceId: string
  spaceName: string
  content: string
  status: string
  submitter: Submitter
  submittedAt: string
  voteCount: number
  response?: string
  respondedAt?: string
  respondedBy?: string
  addedToAIContext: boolean
  convertedToTaskId?: string
  comments: ExternalComment[]
}

type InboundItem = InboundTask | InboundIR

interface Space {
  id: string
  name: string
  slug: string
}

interface InboundResponse {
  items: InboundItem[]
  spaces: Space[]
  counts: {
    tasks: number
    questions: number
    suggestions: number
    total: number
  }
}

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  itemUpdated: [item: InboundItem]
  taskCreated: [taskId: string, itemId: string]
}>()

// State
const items = ref<InboundItem[]>([])
const spaces = ref<Space[]>([])
const counts = ref({ tasks: 0, questions: 0, suggestions: 0, total: 0 })
const loading = ref(true)
const error = ref<string | null>(null)

// Filters
const filterSpace = ref<string | null>(null)
const filterType = ref<'all' | 'task' | 'question' | 'suggestion'>('all')
const filterStatus = ref<string>('pending')
const sortBy = ref<'date' | 'votes'>('date')

// Modals
const showRespondModal = ref(false)
const showRejectModal = ref(false)
const showConvertModal = ref(false)
const showDetailsModal = ref(false)
const selectedItem = ref<InboundItem | null>(null)

// Fetch items
const fetchItems = async () => {
  loading.value = true
  error.value = null
  
  try {
    const params = new URLSearchParams()
    if (filterSpace.value) params.append('spaceId', filterSpace.value)
    if (filterType.value !== 'all') params.append('type', filterType.value)
    if (filterStatus.value) params.append('status', filterStatus.value)
    
    const queryString = params.toString()
    const url = `/api/projects/${props.projectId}/inbound${queryString ? '?' + queryString : ''}`
    
    const response = await $fetch<InboundResponse>(url)
    items.value = response.items
    spaces.value = response.spaces
    counts.value = response.counts
  } catch (e: any) {
    error.value = e.message || 'Failed to load inbound items'
  } finally {
    loading.value = false
  }
}

// Sort items
const sortedItems = computed(() => {
  const sorted = [...items.value]
  if (sortBy.value === 'votes') {
    sorted.sort((a, b) => {
      const votesA = 'voteCount' in a ? a.voteCount : 0
      const votesB = 'voteCount' in b ? b.voteCount : 0
      return votesB - votesA
    })
  } else {
    sorted.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
  }
  return sorted
})

// Actions
const handleAcceptTask = async (item: InboundTask) => {
  try {
    await $fetch(`/api/projects/${props.projectId}/inbound/tasks/${item.id}/accept`, {
      method: 'POST'
    })
    await fetchItems()
    emit('itemUpdated', item)
  } catch (e: any) {
    alert('Failed to accept task: ' + e.message)
  }
}

const handleRejectTask = (item: InboundTask) => {
  selectedItem.value = item
  showRejectModal.value = true
}

const handleRespondIR = (item: InboundIR) => {
  selectedItem.value = item
  showRespondModal.value = true
}

const handleDeclineIR = (item: InboundIR) => {
  selectedItem.value = item
  showRejectModal.value = true
}

const handleConvertToTask = (item: InboundIR) => {
  selectedItem.value = item
  showConvertModal.value = true
}

const handleToggleAIContext = async (item: InboundIR) => {
  try {
    await $fetch(`/api/projects/${props.projectId}/inbound/ir/${item.id}`, {
      method: 'PATCH',
      body: { addedToAIContext: !item.addedToAIContext }
    })
    // Optimistic update
    item.addedToAIContext = !item.addedToAIContext
    emit('itemUpdated', item)
  } catch (e: any) {
    alert('Failed to update: ' + e.message)
  }
}

const handleViewDetails = (item: InboundItem) => {
  selectedItem.value = item
  showDetailsModal.value = true
}

// Modal handlers
const handleRejectConfirm = async (reason: string) => {
  if (!selectedItem.value) return
  
  try {
    if (selectedItem.value.type === 'task') {
      await $fetch(`/api/projects/${props.projectId}/inbound/tasks/${selectedItem.value.id}`, {
        method: 'PATCH',
        body: { status: 'rejected', rejectionReason: reason }
      })
    } else {
      await $fetch(`/api/projects/${props.projectId}/inbound/ir/${selectedItem.value.id}`, {
        method: 'PATCH',
        body: { status: 'declined', response: reason }
      })
    }
    showRejectModal.value = false
    selectedItem.value = null
    await fetchItems()
  } catch (e: any) {
    alert('Failed to reject: ' + e.message)
  }
}

const handleRespondConfirm = async (response: string) => {
  if (!selectedItem.value || selectedItem.value.type === 'task') return
  
  try {
    await $fetch(`/api/projects/${props.projectId}/inbound/ir/${selectedItem.value.id}`, {
      method: 'PATCH',
      body: { response }
    })
    showRespondModal.value = false
    selectedItem.value = null
    await fetchItems()
  } catch (e: any) {
    alert('Failed to respond: ' + e.message)
  }
}

const handleConvertConfirm = async (title: string) => {
  if (!selectedItem.value || selectedItem.value.type === 'task') return
  
  try {
    const result = await $fetch<{ item: { id: string } }>(`/api/projects/${props.projectId}/inbound/ir/${selectedItem.value.id}/convert`, {
      method: 'POST',
      body: { title }
    })
    showConvertModal.value = false
    emit('taskCreated', selectedItem.value.id, result.item.id)
    selectedItem.value = null
    await fetchItems()
  } catch (e: any) {
    alert('Failed to convert: ' + e.message)
  }
}

// Format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return date.toLocaleDateString()
}

// Type badge colors
const typeBadgeClass = (type: string) => {
  switch (type) {
    case 'task': return 'bg-blue-100 text-blue-700'
    case 'question': return 'bg-amber-100 text-amber-700'
    case 'suggestion': return 'bg-emerald-100 text-emerald-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

// Status badge colors
const statusBadgeClass = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-700'
    case 'needs_info': return 'bg-orange-100 text-orange-700'
    case 'accepted': return 'bg-green-100 text-green-700'
    case 'answered': return 'bg-green-100 text-green-700'
    case 'rejected': return 'bg-red-100 text-red-700'
    case 'declined': return 'bg-red-100 text-red-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

// Watch filters
watch([filterSpace, filterType, filterStatus], () => {
  fetchItems()
})

onMounted(fetchItems)

// Expose refresh
defineExpose({ refresh: fetchItems })
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-sm font-medium text-slate-900">Inbound Queue</h2>
        <p class="text-xs text-slate-500 mt-0.5">
          {{ counts.total }} items from stakeholders
        </p>
      </div>
      
      <div class="flex items-center gap-2">
        <!-- Space filter -->
        <select
          v-model="filterSpace"
          class="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
        >
          <option :value="null">All spaces</option>
          <option v-for="space in spaces" :key="space.id" :value="space.id">
            {{ space.name }}
          </option>
        </select>
        
        <!-- Sort -->
        <select
          v-model="sortBy"
          class="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
        >
          <option value="date">Newest first</option>
          <option value="votes">Most votes</option>
        </select>
      </div>
    </div>
    
    <!-- Status Tabs -->
    <div class="flex items-center gap-1 border-b border-slate-200">
      <button
        @click="filterStatus = 'pending'"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          filterStatus === 'pending' 
            ? 'border-violet-600 text-violet-700' 
            : 'border-transparent text-slate-500 hover:text-slate-700'
        ]"
      >
        Pending
        <span class="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">{{ counts.total }}</span>
      </button>
      <button
        @click="filterStatus = 'all'"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          filterStatus === 'all' 
            ? 'border-violet-600 text-violet-700' 
            : 'border-transparent text-slate-500 hover:text-slate-700'
        ]"
      >
        All
      </button>
      <button
        @click="filterStatus = 'resolved'"
        :class="[
          'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
          filterStatus === 'resolved' 
            ? 'border-violet-600 text-violet-700' 
            : 'border-transparent text-slate-500 hover:text-slate-700'
        ]"
      >
        Resolved
      </button>
    </div>
    
    <!-- Type Filter Pills -->
    <div class="flex items-center gap-2">
      <span class="text-xs text-slate-400">Filter:</span>
      <div class="flex items-center gap-1">
        <button
          v-for="opt in ['all', 'task', 'question', 'suggestion'] as const"
          :key="opt"
          @click="filterType = opt"
          :class="[
            'px-2.5 py-1 text-xs font-medium rounded-full transition-all',
            filterType === opt 
              ? 'bg-violet-100 text-violet-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          ]"
        >
          {{ opt === 'all' ? 'All Types' : opt.charAt(0).toUpperCase() + opt.slice(1) + 's' }}
        </button>
      </div>
    </div>
    
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
    </div>
    
    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <Icon name="heroicons:exclamation-circle" class="w-8 h-8 text-red-400 mx-auto mb-2" />
      <p class="text-sm text-slate-600">{{ error }}</p>
      <button @click="fetchItems" class="text-xs text-blue-600 hover:underline mt-2">
        Try again
      </button>
    </div>
    
    <!-- Empty state -->
    <div v-else-if="sortedItems.length === 0" class="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
      <Icon name="heroicons:inbox" class="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <h3 class="text-sm font-medium text-slate-600 mb-1">No pending items</h3>
      <p class="text-xs text-slate-400 max-w-xs mx-auto">
        When stakeholders submit tasks or questions, they'll appear here for your review
      </p>
    </div>
    
    <!-- Items list -->
    <div v-else class="space-y-3">
      <div
        v-for="item in sortedItems"
        :key="item.id"
        class="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
      >
        <div class="flex items-start gap-4">
          <!-- Main content -->
          <div class="flex-1 min-w-0">
            <!-- Header row -->
            <div class="flex items-center gap-2 mb-2">
              <!-- Type badge -->
              <span :class="['px-2 py-0.5 text-[10px] font-medium rounded-full', typeBadgeClass(item.type)]">
                {{ item.type.charAt(0).toUpperCase() + item.type.slice(1) }}
              </span>
              
              <!-- Space name -->
              <span class="text-xs text-slate-400">{{ item.spaceName }}</span>
              
              <!-- Status badge (for non-pending) -->
              <span
                v-if="item.status !== 'pending'"
                :class="['px-2 py-0.5 text-[10px] font-medium rounded-full', statusBadgeClass(item.status)]"
              >
                {{ item.status.replace('_', ' ') }}
              </span>
              
              <!-- Vote count for IRs -->
              <span
                v-if="item.type !== 'task' && (item as InboundIR).voteCount > 0"
                class="flex items-center gap-0.5 text-xs text-slate-500"
              >
                <Icon name="heroicons:arrow-up" class="w-3 h-3" />
                {{ (item as InboundIR).voteCount }}
              </span>
              
              <!-- AI Context badge -->
              <span
                v-if="item.type !== 'task' && (item as InboundIR).addedToAIContext"
                class="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-purple-100 text-purple-700"
              >
                <Icon name="heroicons:sparkles" class="w-3 h-3" />
                AI
              </span>
            </div>
            
            <!-- Title/Content -->
            <h3 class="text-sm font-medium text-slate-900 mb-1">
              {{ item.type === 'task' ? (item as InboundTask).title : (item as InboundIR).content.substring(0, 100) }}
              <span v-if="item.type !== 'task' && (item as InboundIR).content.length > 100">...</span>
            </h3>
            
            <!-- Description preview for tasks -->
            <p
              v-if="item.type === 'task' && (item as InboundTask).description"
              class="text-xs text-slate-500 line-clamp-2 mb-2"
            >
              {{ (item as InboundTask).description }}
            </p>
            
            <!-- Submitter info -->
            <div class="flex items-center gap-2 text-xs text-slate-400">
              <span>{{ item.submitter.displayName }}</span>
              <span v-if="item.submitter.position" class="text-slate-300">•</span>
              <span v-if="item.submitter.position">{{ item.submitter.position }}</span>
              <span class="text-slate-300">•</span>
              <span>{{ formatDate(item.submittedAt) }}</span>
            </div>
          </div>
          
          <!-- Actions -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Task actions (pending or needs_info) -->
            <template v-if="item.type === 'task' && (item.status === 'pending' || item.status === 'needs_info')">
              <button
                @click="handleAcceptTask(item as InboundTask)"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                title="Accept & create task"
              >
                <Icon name="heroicons:check" class="w-3.5 h-3.5" />
                Accept
              </button>
              <button
                @click="handleRejectTask(item as InboundTask)"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                title="Reject"
              >
                <Icon name="heroicons:x-mark" class="w-3.5 h-3.5" />
                Reject
              </button>
            </template>
            
            <!-- IR actions (pending only) -->
            <template v-else-if="item.type !== 'task' && item.status === 'pending'">
              <button
                @click="handleRespondIR(item as InboundIR)"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                title="Respond to question"
              >
                <Icon name="heroicons:chat-bubble-left-right" class="w-3.5 h-3.5" />
                Respond
              </button>
              <button
                v-if="item.type === 'suggestion'"
                @click="handleConvertToTask(item as InboundIR)"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                title="Convert to task"
              >
                <Icon name="heroicons:plus-circle" class="w-3.5 h-3.5" />
                Convert
              </button>
              <button
                @click="handleDeclineIR(item as InboundIR)"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                title="Decline"
              >
                <Icon name="heroicons:x-mark" class="w-3.5 h-3.5" />
                Decline
              </button>
            </template>
            
            <!-- Secondary actions -->
            <div class="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
              <!-- AI Context toggle for IRs -->
              <button
                v-if="item.type !== 'task'"
                @click="handleToggleAIContext(item as InboundIR)"
                :class="[
                  'p-1.5 rounded-lg transition-colors',
                  (item as InboundIR).addedToAIContext
                    ? 'text-purple-600 bg-purple-50'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                ]"
                :title="(item as InboundIR).addedToAIContext ? 'Remove from AI context' : 'Add to AI context'"
              >
                <Icon name="heroicons:sparkles" class="w-4 h-4" />
              </button>
              
              <!-- View details -->
              <button
                @click="handleViewDetails(item)"
                class="flex items-center gap-1 p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                title="View details & reply"
              >
                <Icon name="heroicons:chat-bubble-left-ellipsis" class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Respond Modal -->
    <ExternalInboundRespondModal
      :open="showRespondModal"
      :item="selectedItem as InboundIR | null"
      @close="showRespondModal = false"
      @confirm="handleRespondConfirm"
    />
    
    <!-- Reject Modal -->
    <ExternalInboundRejectModal
      :open="showRejectModal"
      :item="selectedItem"
      @close="showRejectModal = false"
      @confirm="handleRejectConfirm"
    />
    
    <!-- Convert Modal -->
    <ExternalInboundConvertModal
      :open="showConvertModal"
      :item="selectedItem as InboundIR | null"
      @close="showConvertModal = false"
      @confirm="handleConvertConfirm"
    />
    
    <!-- Details Modal -->
    <ExternalInboundDetailsModal
      :open="showDetailsModal"
      :item="selectedItem"
      :project-id="projectId"
      @close="showDetailsModal = false"
      @action="fetchItems"
    />
  </div>
</template>
