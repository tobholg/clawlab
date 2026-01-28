<script setup lang="ts">
import type { ItemNode } from '~/types'
import { STATUS_CONFIG, CATEGORY_COLORS } from '~/types'

const props = defineProps<{
  open: boolean
  item: ItemNode | null
}>()

const emit = defineEmits<{
  close: []
  update: [id: string, data: any]
  viewFull: [item: ItemNode]
}>()

// Focus management
const { currentFocus, startFocus, clearFocus, isFocusedOn, isLoading: focusLoading, currentUserId } = useFocus()

// Item detail fetched via $fetch when item changes
const itemDetail = ref<any>(null)
const refreshItem = async () => {
  if (props.item?.id) {
    try {
      itemDetail.value = await $fetch(`/api/items/${props.item.id}`)
      console.log('Loaded item detail:', itemDetail.value)
    } catch (e) {
      console.error('Failed to fetch item details:', e)
    }
  }
}

// Fetch when item changes OR modal opens
watch([() => props.item?.id, () => props.open], ([id, isOpen]) => {
  if (id && isOpen) {
    refreshItem()
  } else if (!isOpen) {
    // Clear when modal closes
    itemDetail.value = null
  }
}, { immediate: true })

// Available users for assignment
const availableUsers = ref<any[]>([])

// Fetch available users when item changes
watch(() => props.item?.id, async (itemId) => {
  if (itemId) {
    try {
      availableUsers.value = await $fetch(`/api/items/${itemId}/available-users`)
    } catch {
      // Fallback to all users
      availableUsers.value = await $fetch('/api/users')
    }
  }
}, { immediate: true })

// Editable fields
const editedTitle = ref('')
const editedDescription = ref('')
const editedStatus = ref('')
const editedCategory = ref('')
const editedProgress = ref(0)
const editedConfidence = ref(70)
const editedDueDate = ref('')
const editedStartDate = ref('')

// UI state
const showAssigneeDropdown = ref(false)
const newComment = ref('')
const replyingTo = ref<string | null>(null)
const replyText = ref('')
const isSaving = ref(false)
const saveTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const hasUnsavedChanges = ref(false)
const isInitializing = ref(true) // Prevent auto-save during initial load

// Load form data from itemDetail (full API data) when it loads
watch(itemDetail, (detail) => {
  if (detail) {
    isInitializing.value = true
    editedTitle.value = detail.title ?? ''
    editedDescription.value = detail.description ?? ''
    editedStatus.value = detail.status ?? 'todo'
    editedCategory.value = detail.category ?? ''
    editedProgress.value = detail.progress ?? 0
    editedConfidence.value = detail.confidence ?? 70
    editedDueDate.value = detail.dueDate?.split('T')[0] ?? ''
    editedStartDate.value = detail.startDate?.split('T')[0] ?? ''
    // Allow auto-save after a tick
    nextTick(() => {
      isInitializing.value = false
    })
  }
}, { immediate: true })

// Also reset when modal opens with a new item
watch(() => props.open, (isOpen) => {
  if (isOpen && props.item) {
    isInitializing.value = true
    // Reset to item's basic data while waiting for itemDetail to load
    editedTitle.value = props.item.title ?? ''
    editedDescription.value = props.item.description ?? ''
    editedStatus.value = props.item.status ?? 'todo'
    editedCategory.value = props.item.category ?? ''
    editedProgress.value = props.item.progress ?? 0
    editedConfidence.value = props.item.confidence ?? 70
    editedDueDate.value = props.item.dueDate?.split('T')[0] ?? ''
    hasUnsavedChanges.value = false
  }
})

// Calculate estimated completion date range with full breakdown + probability of missing due date
const estimatedCompletion = computed(() => {
  const progress = editedProgress.value
  const confidence = editedConfidence.value
  
  if (!editedStartDate.value || progress === 0) return null
  
  const startDate = new Date(editedStartDate.value)
  const now = new Date()
  const daysSpent = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
  
  if (progress >= 100) {
    return { complete: true, daysSpent, missProb: 0 }
  }
  
  const totalEstimate = Math.round(daysSpent / (progress / 100))
  const remainingDays = Math.max(1, totalEstimate - daysSpent)
  
  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() + remainingDays)
  
  // Uncertainty band based on confidence
  // Lower confidence = wider band
  const bandDays = Math.ceil(remainingDays * (1 - confidence / 100) * 2)
  
  const earliest = new Date(baseDate)
  earliest.setDate(earliest.getDate() - Math.floor(bandDays / 2))
  const latest = new Date(baseDate)
  latest.setDate(latest.getDate() + Math.ceil(bandDays / 2))
  
  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  
  // Calculate probability of missing due date
  // Uses a simplified normal distribution approximation
  let missProb = 0
  let daysUntilDue = 0
  
  if (editedDueDate.value) {
    const dueDate = new Date(editedDueDate.value)
    daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    
    // If due date is before estimated completion, calculate how far into the uncertainty band it falls
    // Mean = remainingDays, StdDev approximation = bandDays / 4 (95% within 2 stddev)
    const stdDev = Math.max(1, bandDays / 4)
    const zScore = (daysUntilDue - remainingDays) / stdDev
    
    // Approximate CDF of standard normal using logistic approximation
    // P(X > dueDate) = 1 - CDF(zScore)
    // CDF(z) ≈ 1 / (1 + exp(-1.702 * z))
    const cdf = 1 / (1 + Math.exp(-1.702 * zScore))
    missProb = Math.round((1 - cdf) * 100)
    
    // Clamp between 0-100
    missProb = Math.max(0, Math.min(100, missProb))
  }
  
  return {
    complete: false,
    daysSpent,
    totalEstimate,
    remainingDays,
    baseDate: formatDate(baseDate),
    baseDateRaw: baseDate,
    earliest: formatDate(earliest),
    latest: formatDate(latest),
    bandDays,
    isExact: confidence >= 95,
    velocity: Math.round(progress / daysSpent * 10) / 10,
    missProb,
    daysUntilDue,
  }
})

// Auto-save with debounce
const saveChanges = async () => {
  if (!props.item || !props.open) return
  isSaving.value = true
  
  const payload = {
    title: editedTitle.value,
    description: editedDescription.value,
    status: editedStatus.value,
    category: editedCategory.value,
    progress: editedProgress.value,
    confidence: editedConfidence.value,
    dueDate: editedDueDate.value || null,
    startDate: editedStartDate.value || null,
  }
  
  try {
    await $fetch(`/api/items/${props.item.id}`, {
      method: 'PATCH',
      body: payload
    })
    hasUnsavedChanges.value = false
    // Emit update to refresh parent list (don't close modal)
    emit('update', props.item.id, { _saved: true, _close: false })
  } catch (e) {
    console.error('Failed to save:', e)
  } finally {
    isSaving.value = false
  }
}

// Debounced save - waits 500ms after last change
const debouncedSave = () => {
  hasUnsavedChanges.value = true
  if (saveTimeout.value) clearTimeout(saveTimeout.value)
  saveTimeout.value = setTimeout(() => {
    saveChanges()
  }, 500)
}

// Immediate save for important changes (status, etc)
const immediateSave = async () => {
  if (saveTimeout.value) clearTimeout(saveTimeout.value)
  await saveChanges()
}

// Watch status changes - auto-set startDate when moving to in_progress
watch(editedStatus, async (newStatus, oldStatus) => {
  // Skip during initialization
  if (isInitializing.value) return
  
  if (newStatus === 'in_progress' && oldStatus !== 'in_progress') {
    // Set start date to today if not already set
    if (!editedStartDate.value) {
      editedStartDate.value = new Date().toISOString().split('T')[0]
    }
  }
  if (oldStatus && newStatus !== oldStatus) {
    await immediateSave()
    // Refresh to get any auto-set fields from backend
    await refreshItem()
  }
})

// Watch all fields for auto-save (debounced)
watch([editedTitle, editedDescription, editedCategory, editedDueDate, editedStartDate], () => {
  if (props.open && itemDetail.value && !isInitializing.value) {
    debouncedSave()
  }
})

// Watch progress and confidence for auto-save (debounced)
watch([editedProgress, editedConfidence], () => {
  if (props.open && itemDetail.value && !isInitializing.value) {
    debouncedSave()
  }
})

// Clean up timeout on unmount
onUnmounted(() => {
  if (saveTimeout.value) clearTimeout(saveTimeout.value)
})

// Close modal handler - ensure any pending save completes
const handleClose = async () => {
  if (saveTimeout.value) {
    clearTimeout(saveTimeout.value)
    await saveChanges()
  }
  // Signal parent to close and refresh
  emit('update', props.item?.id ?? '', { _close: true })
  emit('close')
}

// Assign user
const assignUser = async (userId: string) => {
  if (!props.item) return
  try {
    await $fetch(`/api/items/${props.item.id}/assignees`, {
      method: 'POST',
      body: { userId }
    })
    await refreshItem()
    showAssigneeDropdown.value = false
  } catch (e) {
    console.error('Failed to assign user:', e)
  }
}

// Remove assignee
const removeAssignee = async (userId: string) => {
  if (!props.item) return
  try {
    await $fetch(`/api/items/${props.item.id}/assignees/${userId}`, {
      method: 'DELETE'
    })
    await refreshItem()
  } catch (e) {
    console.error('Failed to remove assignee:', e)
  }
}

// Get users not yet assigned
const unassignedUsers = computed(() => {
  if (!availableUsers.value || !itemDetail.value?.assignees) return []
  const assignedIds = new Set(itemDetail.value.assignees.map((a: any) => a.id))
  return availableUsers.value.filter((u: any) => !assignedIds.has(u.id))
})

// Comments
const submitComment = async () => {
  if (!newComment.value.trim() || !props.item) return
  
  try {
    await $fetch(`/api/items/${props.item.id}/comments`, {
      method: 'POST',
      body: { 
        content: newComment.value,
        userId: currentUserId.value 
      }
    })
    newComment.value = ''
    await refreshItem()
  } catch (e) {
    console.error('Failed to post comment:', e)
  }
}

const submitReply = async (parentId: string) => {
  if (!replyText.value.trim() || !props.item) return
  
  try {
    await $fetch(`/api/items/${props.item.id}/comments`, {
      method: 'POST',
      body: { 
        content: replyText.value, 
        parentCommentId: parentId,
        userId: currentUserId.value 
      }
    })
    replyText.value = ''
    replyingTo.value = null
    await refreshItem()
  } catch (e) {
    console.error('Failed to post reply:', e)
  }
}

// View full board
const handleViewFull = () => {
  if (props.item) {
    emit('viewFull', props.item)
    emit('close')
  }
}

// Status options
const statusOptions = Object.entries(STATUS_CONFIG).map(([key, config]) => ({
  value: key,
  label: config.label,
}))

// Category options
const categoryOptions = Object.keys(CATEGORY_COLORS)

// Close on escape
onMounted(() => {
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && props.open) {
      handleClose()
    }
  }
  window.addEventListener('keydown', handleKeydown)
  onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
})

// Close dropdown when clicking outside
const assigneeDropdownRef = ref<HTMLElement | null>(null)
onMounted(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (assigneeDropdownRef.value && !assigneeDropdownRef.value.contains(e.target as Node)) {
      showAssigneeDropdown.value = false
    }
  }
  document.addEventListener('click', handleClickOutside)
  onUnmounted(() => document.removeEventListener('click', handleClickOutside))
})

// Format relative time for comments
const formatRelativeTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="open && item" 
        class="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] pb-[5vh] overflow-y-auto"
      >
        <!-- Backdrop -->
        <div 
          class="fixed inset-0 bg-slate-900/30 backdrop-blur-sm"
          @click="handleClose"
        />
        
        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <!-- Category -->
              <select
                v-model="editedCategory"
                class="text-xs font-normal px-2 py-1 rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
              >
                <option value="">No category</option>
                <option v-for="cat in categoryOptions" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
              
              <!-- Status -->
              <select
                v-model="editedStatus"
                class="text-xs font-normal px-2 py-1 rounded-full border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
              >
                <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
            
            <div class="flex items-center gap-2">
              <!-- Focus Button -->
              <button
                v-if="!isFocusedOn(item.id)"
                @click="startFocus(item.id, item.title)"
                :disabled="focusLoading"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-xs font-medium hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 shadow-sm"
              >
                <Icon name="heroicons:bolt" class="w-3.5 h-3.5" />
                Start Focus
              </button>
              <button
                v-else
                @click="clearFocus"
                :disabled="focusLoading"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg text-xs font-medium hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-sm"
              >
                <Icon name="heroicons:bolt-slash" class="w-3.5 h-3.5" />
                End Focus
              </button>
              
              <!-- Close button -->
              <button 
                @click="handleClose"
                class="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <!-- Content -->
          <div class="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <!-- Title -->
            <input
              v-model="editedTitle"
              type="text"
              class="w-full text-xl font-medium text-slate-900 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-slate-300"
              placeholder="Task title..."
            />
            
            <!-- Description -->
            <textarea
              v-model="editedDescription"
              rows="3"
              class="w-full text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border-0 focus:outline-none focus:ring-2 focus:ring-slate-200 resize-none placeholder-slate-400"
              placeholder="Add a description..."
            />
            
            <!-- Dates Row -->
            <div class="grid grid-cols-2 gap-6">
              <!-- Start Date -->
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-2">Started</label>
                <input
                  v-model="editedStartDate"
                  type="date"
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300"
                />
              </div>
              
              <!-- Due Date -->
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-2">Due Date</label>
                <input
                  v-model="editedDueDate"
                  type="date"
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300"
                  :class="editedDueDate && new Date(editedDueDate) < new Date() ? 'border-rose-300 bg-rose-50' : ''"
                />
              </div>
            </div>
            
            <!-- Assignees (full row) -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-2">Assigned To</label>
              <div class="flex flex-wrap gap-2">
                <template v-if="itemDetail?.assignees?.length">
                  <div 
                    v-for="assignee in itemDetail.assignees" 
                    :key="assignee.id"
                    class="group flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-full text-xs"
                  >
                    <div class="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                      <span class="text-[8px] text-white font-medium">{{ assignee.name?.[0] ?? 'U' }}</span>
                    </div>
                    <span>{{ assignee.name }}</span>
                    <button 
                      @click="removeAssignee(assignee.id)"
                      class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded transition-all"
                    >
                      <Icon name="heroicons:x-mark" class="w-3 h-3 text-slate-400" />
                    </button>
                  </div>
                </template>
                
                <!-- Add button with dropdown -->
                <div class="relative" ref="assigneeDropdownRef">
                  <button 
                    @click.stop="showAssigneeDropdown = !showAssigneeDropdown"
                    class="flex items-center gap-1 px-2 py-1 border border-dashed border-slate-300 rounded-full text-xs text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors"
                  >
                    <Icon name="heroicons:plus" class="w-3 h-3" />
                    Add
                  </button>
                  
                  <!-- Dropdown -->
                  <Transition name="dropdown">
                    <div 
                      v-if="showAssigneeDropdown"
                      class="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10"
                    >
                      <div v-if="unassignedUsers.length === 0" class="px-3 py-2 text-xs text-slate-400">
                        No more users to add
                      </div>
                      <button
                        v-for="user in unassignedUsers"
                        :key="user.id"
                        @click="assignUser(user.id)"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                          <span class="text-[10px] text-white font-medium">{{ user.name?.[0] ?? 'U' }}</span>
                        </div>
                        <span>{{ user.name }}</span>
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>
            
            <!-- Progress & Confidence Sliders -->
            <div class="grid grid-cols-2 gap-6">
              <!-- Progress -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-xs font-medium text-slate-500">Progress</label>
                  <span class="text-xs font-medium text-slate-700">{{ editedProgress }}%</span>
                </div>
                <div class="relative">
                  <div class="h-2 bg-slate-200 rounded-lg overflow-hidden">
                    <div 
                      class="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all"
                      :style="{ width: `${editedProgress}%` }"
                    />
                  </div>
                  <input
                    v-model.number="editedProgress"
                    type="range"
                    min="0"
                    max="100"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
              
              <!-- Confidence -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-xs font-medium text-slate-500">Confidence</label>
                  <span class="text-xs font-medium text-slate-700">{{ editedConfidence }}%</span>
                </div>
                <div class="relative">
                  <div class="h-2 bg-slate-200 rounded-lg overflow-hidden">
                    <div 
                      class="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                      :style="{ width: `${editedConfidence}%` }"
                    />
                  </div>
                  <input
                    v-model.number="editedConfidence"
                    type="range"
                    min="0"
                    max="100"
                    class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
            
            <!-- Estimated Completion Card -->
            <div 
              v-if="estimatedCompletion" 
              class="rounded-xl p-4 border transition-colors"
              :class="[
                estimatedCompletion.complete 
                  ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border-emerald-100/50'
                  : estimatedCompletion.missProb > 66 
                    ? 'bg-gradient-to-br from-rose-50 via-red-50 to-orange-50 border-rose-200/50'
                    : estimatedCompletion.missProb > 33 
                      ? 'bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 border-amber-200/50'
                      : 'bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 border-emerald-100/50'
              ]"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div 
                    class="p-1.5 bg-white/80 rounded-lg shadow-sm"
                  >
                    <Icon 
                      :name="estimatedCompletion.missProb > 66 ? 'heroicons:exclamation-triangle' : estimatedCompletion.missProb > 33 ? 'heroicons:clock' : 'heroicons:sparkles'" 
                      class="w-4 h-4"
                      :class="[
                        estimatedCompletion.missProb > 66 ? 'text-rose-500' : 
                        estimatedCompletion.missProb > 33 ? 'text-amber-500' : 'text-emerald-500'
                      ]"
                    />
                  </div>
                  <span 
                    class="text-sm font-medium"
                    :class="[
                      estimatedCompletion.missProb > 66 ? 'text-rose-800' : 
                      estimatedCompletion.missProb > 33 ? 'text-amber-800' : 'text-emerald-800'
                    ]"
                  >
                    Estimated Completion
                  </span>
                </div>
                <div v-if="!estimatedCompletion.complete" class="text-right">
                  <div 
                    class="text-lg font-semibold"
                    :class="[
                      estimatedCompletion.missProb > 66 ? 'text-rose-700' : 
                      estimatedCompletion.missProb > 33 ? 'text-amber-700' : 'text-emerald-700'
                    ]"
                  >
                    {{ estimatedCompletion.isExact ? estimatedCompletion.baseDate : `${estimatedCompletion.earliest} – ${estimatedCompletion.latest}` }}
                  </div>
                  <div 
                    class="text-[10px]"
                    :class="[
                      estimatedCompletion.missProb > 66 ? 'text-rose-600/60' : 
                      estimatedCompletion.missProb > 33 ? 'text-amber-600/60' : 'text-emerald-600/60'
                    ]"
                  >
                    {{ estimatedCompletion.isExact ? 'High confidence estimate ✓' : `±${Math.floor(estimatedCompletion.bandDays / 2)} days @ ${editedConfidence}% confidence` }}
                  </div>
                </div>
                <div v-else class="flex items-center gap-1.5 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                  <Icon name="heroicons:check-circle" class="w-3.5 h-3.5" />
                  Complete
                </div>
              </div>
              
              <div v-if="!estimatedCompletion.complete" class="grid grid-cols-3 gap-3 text-center">
                <div class="bg-white/70 backdrop-blur-sm rounded-lg p-2">
                  <div class="text-lg font-semibold text-slate-700">{{ estimatedCompletion.daysSpent }}</div>
                  <div 
                    class="text-[10px] uppercase tracking-wide"
                    :class="[
                      estimatedCompletion.missProb > 66 ? 'text-rose-600/70' : 
                      estimatedCompletion.missProb > 33 ? 'text-amber-600/70' : 'text-emerald-600/70'
                    ]"
                  >Days Spent</div>
                </div>
                <div class="bg-white/70 backdrop-blur-sm rounded-lg p-2">
                  <div class="text-lg font-semibold text-slate-700">{{ estimatedCompletion.totalEstimate }}</div>
                  <div 
                    class="text-[10px] uppercase tracking-wide"
                    :class="[
                      estimatedCompletion.missProb > 66 ? 'text-rose-600/70' : 
                      estimatedCompletion.missProb > 33 ? 'text-amber-600/70' : 'text-emerald-600/70'
                    ]"
                  >Total Est.</div>
                </div>
                <div class="bg-white/70 backdrop-blur-sm rounded-lg p-2">
                  <div 
                    class="text-lg font-semibold"
                    :class="[
                      estimatedCompletion.missProb > 66 ? 'text-rose-600' : 
                      estimatedCompletion.missProb > 33 ? 'text-amber-600' : 'text-emerald-600'
                    ]"
                  >{{ estimatedCompletion.remainingDays }}</div>
                  <div 
                    class="text-[10px] uppercase tracking-wide"
                    :class="[
                      estimatedCompletion.missProb > 66 ? 'text-rose-600/70' : 
                      estimatedCompletion.missProb > 33 ? 'text-amber-600/70' : 'text-emerald-600/70'
                    ]"
                  >Days Left</div>
                </div>
              </div>
              
              <!-- Probability of missing due date -->
              <div 
                v-if="!estimatedCompletion.complete && editedDueDate && estimatedCompletion.missProb > 0" 
                class="mt-3 p-2 rounded-lg text-center"
                :class="[
                  estimatedCompletion.missProb > 66 
                    ? 'bg-rose-100/80' 
                    : estimatedCompletion.missProb > 33 
                      ? 'bg-amber-100/80' 
                      : 'bg-white/50'
                ]"
              >
                <div class="flex items-center justify-center gap-2">
                  <Icon 
                    :name="estimatedCompletion.missProb > 66 ? 'heroicons:exclamation-circle' : 'heroicons:information-circle'" 
                    class="w-4 h-4"
                    :class="[
                      estimatedCompletion.missProb > 66 ? 'text-rose-600' : 
                      estimatedCompletion.missProb > 33 ? 'text-amber-600' : 'text-slate-500'
                    ]"
                  />
                  <span 
                    class="text-xs font-medium"
                    :class="[
                      estimatedCompletion.missProb > 66 ? 'text-rose-700' : 
                      estimatedCompletion.missProb > 33 ? 'text-amber-700' : 'text-slate-600'
                    ]"
                  >
                    {{ estimatedCompletion.missProb }}% chance of missing due date
                  </span>
                </div>
                <div 
                  class="text-[10px] mt-1"
                  :class="[
                    estimatedCompletion.missProb > 66 ? 'text-rose-600/70' : 
                    estimatedCompletion.missProb > 33 ? 'text-amber-600/70' : 'text-slate-500'
                  ]"
                >
                  Due in {{ estimatedCompletion.daysUntilDue }} days, est. {{ estimatedCompletion.remainingDays }} days remaining
                </div>
              </div>
              
              <p 
                v-if="!estimatedCompletion.complete" 
                class="text-[10px] mt-3 text-center"
                :class="[
                  estimatedCompletion.missProb > 66 ? 'text-rose-600/60' : 
                  estimatedCompletion.missProb > 33 ? 'text-amber-600/60' : 'text-emerald-600/60'
                ]"
              >
                {{ editedProgress }}% over {{ estimatedCompletion.daysSpent }} days = {{ estimatedCompletion.velocity }}%/day velocity {{ estimatedCompletion.missProb <= 33 ? '✨' : '' }}
              </p>
            </div>
            
            <!-- No estimate message -->
            <div v-else-if="editedProgress === 0" class="bg-slate-50 rounded-xl p-4 border border-dashed border-slate-200 text-center">
              <Icon name="heroicons:calculator" class="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <p class="text-xs text-slate-400">Set a start date and progress to see estimated completion</p>
            </div>
            
            <!-- Subtasks Section -->
            <div v-if="itemDetail?.children?.length > 0 || itemDetail?.childrenCount > 0">
              <div class="flex items-center justify-between mb-3">
                <h3 class="text-sm font-medium text-slate-700">
                  Subtasks
                  <span class="text-slate-400 font-normal">({{ itemDetail.children?.length || itemDetail.childrenCount }})</span>
                </h3>
                <button class="text-xs text-blue-500 hover:text-blue-600 font-medium transition-colors">
                  + Add subtask
                </button>
              </div>
              
              <!-- Subtasks progress overview -->
              <div v-if="itemDetail.children?.length" class="mb-3">
                <div class="flex items-center gap-3 text-xs text-slate-500 mb-2">
                  <span>{{ itemDetail.children.filter((c: any) => c.status === 'done').length }} of {{ itemDetail.children.length }} complete</span>
                  <span class="text-slate-300">•</span>
                  <span>{{ Math.round(itemDetail.children.filter((c: any) => c.status === 'done').length / itemDetail.children.length * 100) }}%</span>
                </div>
                <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    class="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
                    :style="{ width: `${itemDetail.children.filter((c: any) => c.status === 'done').length / itemDetail.children.length * 100}%` }"
                  />
                </div>
              </div>
              
              <!-- Subtasks list -->
              <div class="space-y-2">
                <div 
                  v-for="subtask in itemDetail.children" 
                  :key="subtask.id"
                  class="group flex items-center gap-3 p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  @click="$emit('viewFull', subtask)"
                >
                  <!-- Status checkbox -->
                  <div 
                    :class="[
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                      subtask.status === 'done' 
                        ? 'bg-emerald-500 border-emerald-500' 
                        : subtask.status === 'blocked'
                          ? 'bg-rose-100 border-rose-300'
                          : subtask.status === 'in_progress'
                            ? 'bg-blue-100 border-blue-400'
                            : 'bg-white border-slate-300'
                    ]"
                  >
                    <Icon 
                      v-if="subtask.status === 'done'" 
                      name="heroicons:check" 
                      class="w-3 h-3 text-white" 
                    />
                    <Icon 
                      v-else-if="subtask.status === 'blocked'" 
                      name="heroicons:no-symbol" 
                      class="w-3 h-3 text-rose-500" 
                    />
                    <div 
                      v-else-if="subtask.status === 'in_progress'" 
                      class="w-2 h-2 rounded-full bg-blue-500"
                    />
                  </div>
                  
                  <!-- Content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span 
                        :class="[
                          'text-sm font-medium truncate',
                          subtask.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700'
                        ]"
                      >
                        {{ subtask.title }}
                      </span>
                      <span 
                        v-if="subtask.childrenCount > 0" 
                        class="flex items-center gap-0.5 text-[10px] text-slate-400"
                      >
                        <Icon name="heroicons:square-3-stack-3d" class="w-3 h-3" />
                        {{ subtask.childrenCount }}
                      </span>
                    </div>
                    
                    <!-- Meta row -->
                    <div class="flex items-center gap-2 mt-1">
                      <!-- Progress bar (if in progress) -->
                      <div v-if="subtask.status === 'in_progress' && subtask.progress > 0" class="flex items-center gap-1.5">
                        <div class="w-16 h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            class="h-full bg-blue-400 rounded-full"
                            :style="{ width: `${subtask.progress}%` }"
                          />
                        </div>
                        <span class="text-[10px] text-slate-400">{{ subtask.progress }}%</span>
                      </div>
                      
                      <!-- Due date -->
                      <span 
                        v-if="subtask.dueDate" 
                        :class="[
                          'text-[10px]',
                          new Date(subtask.dueDate) < new Date() && subtask.status !== 'done' 
                            ? 'text-rose-500' 
                            : 'text-slate-400'
                        ]"
                      >
                        {{ new Date(subtask.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}
                      </span>
                    </div>
                  </div>
                  
                  <!-- Assignee -->
                  <div v-if="subtask.assignee" class="flex-shrink-0">
                    <div 
                      class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center"
                      :title="subtask.assignee.name"
                    >
                      <span class="text-[10px] text-white font-medium">{{ subtask.assignee.name?.[0] }}</span>
                    </div>
                  </div>
                  
                  <!-- Chevron -->
                  <Icon 
                    name="heroicons:chevron-right" 
                    class="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" 
                  />
                </div>
              </div>
              
              <!-- View all button -->
              <button 
                v-if="itemDetail.children?.length > 5"
                class="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-700 font-medium text-center bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                @click="$emit('viewFull', item)"
              >
                View all {{ itemDetail.childrenCount }} subtasks
              </button>
            </div>
            
            <!-- Comments Section -->
            <div>
              <h3 class="text-sm font-medium text-slate-700 mb-3">
                Comments
                <span v-if="itemDetail?.comments?.length" class="text-slate-400 font-normal">
                  ({{ itemDetail.comments.length }})
                </span>
              </h3>
              
              <!-- New comment input -->
              <div class="flex gap-3 mb-4">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <span class="text-xs text-white font-medium">Y</span>
                </div>
                <div class="flex-1">
                  <textarea
                    v-model="newComment"
                    rows="2"
                    class="w-full text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none placeholder-slate-400"
                    placeholder="Write a comment..."
                    @keydown.meta.enter="submitComment"
                    @keydown.ctrl.enter="submitComment"
                  />
                  <div class="flex justify-end mt-2">
                    <button
                      @click="submitComment"
                      :disabled="!newComment.trim()"
                      class="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Comment
                    </button>
                  </div>
                </div>
              </div>
              
              <!-- Comments list -->
              <div v-if="itemDetail?.comments?.length" class="space-y-4">
                <div 
                  v-for="comment in itemDetail.comments" 
                  :key="comment.id"
                  class="group"
                >
                  <div class="flex gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                      <span class="text-xs text-slate-600 font-medium">
                        {{ comment.user?.name?.[0] ?? 'U' }}
                      </span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-sm font-medium text-slate-800">{{ comment.user?.name ?? 'User' }}</span>
                        <span class="text-xs text-slate-400">{{ formatRelativeTime(comment.createdAt) }}</span>
                      </div>
                      <p class="text-sm text-slate-600 whitespace-pre-wrap">{{ comment.content }}</p>
                      
                      <!-- Reply button -->
                      <button
                        @click="replyingTo = replyingTo === comment.id ? null : comment.id"
                        class="text-xs text-slate-400 hover:text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Reply
                      </button>
                      
                      <!-- Reply input -->
                      <div v-if="replyingTo === comment.id" class="mt-2 ml-2 pl-3 border-l-2 border-slate-200">
                        <textarea
                          v-model="replyText"
                          rows="2"
                          class="w-full text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 resize-none placeholder-slate-400"
                          placeholder="Write a reply..."
                          @keydown.meta.enter="submitReply(comment.id)"
                          @keydown.ctrl.enter="submitReply(comment.id)"
                        />
                        <div class="flex justify-end gap-2 mt-2">
                          <button
                            @click="replyingTo = null; replyText = ''"
                            class="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                          <button
                            @click="submitReply(comment.id)"
                            :disabled="!replyText.trim()"
                            class="px-2 py-1 text-xs font-medium text-white bg-slate-700 rounded hover:bg-slate-800 transition-colors disabled:opacity-50"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                      
                      <!-- Nested replies -->
                      <div v-if="comment.replies?.length" class="mt-3 ml-2 pl-3 border-l-2 border-slate-100 space-y-3">
                        <div 
                          v-for="reply in comment.replies" 
                          :key="reply.id"
                          class="flex gap-2"
                        >
                          <div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <span class="text-[10px] text-slate-600 font-medium">
                              {{ reply.user?.name?.[0] ?? 'U' }}
                            </span>
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-0.5">
                              <span class="text-xs font-medium text-slate-700">{{ reply.user?.name ?? 'User' }}</span>
                              <span class="text-[10px] text-slate-400">{{ formatRelativeTime(reply.createdAt) }}</span>
                            </div>
                            <p class="text-xs text-slate-600 whitespace-pre-wrap">{{ reply.content }}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Empty state -->
              <div v-else class="text-center py-6 text-slate-400">
                <Icon name="heroicons:chat-bubble-left-ellipsis" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p class="text-xs">No comments yet. Start the conversation!</p>
              </div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <button
              @click="handleViewFull"
              class="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Icon name="heroicons:arrow-top-right-on-square" class="w-4 h-4" />
              View Full Board
            </button>
            
            <div class="flex items-center gap-3">
              <!-- Auto-save indicator -->
              <span v-if="isSaving" class="flex items-center gap-1.5 text-xs text-slate-400">
                <Icon name="heroicons:arrow-path" class="w-3.5 h-3.5 animate-spin" />
                Saving...
              </span>
              <span v-else-if="hasUnsavedChanges" class="text-xs text-amber-500">
                Unsaved
              </span>
              
              <button
                @click="handleClose"
                class="px-4 py-2 text-sm font-normal text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.2s ease;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95) translateY(-10px);
}

.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
