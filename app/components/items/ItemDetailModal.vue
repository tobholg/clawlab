<script setup lang="ts">
import type { ItemNode } from '~/types'
import { STATUS_CONFIG, CATEGORY_COLORS, SUB_STATUS_CONFIG, SUB_STATUS_BY_STATUS, getSubStatusesForStatus, COMPLEXITY_OPTIONS, PRIORITY_OPTIONS } from '~/types'

const props = defineProps<{
  open: boolean
  item: ItemNode | null
}>()

const emit = defineEmits<{
  close: []
  update: [id: string, data: any]
  viewFull: [item: ItemNode]
  deleted: [id: string]
}>()

const router = useRouter()

// Focus management
const { focusState, startTaskFocus, completeTask, isFocusedOnTask, isLoading: focusLoading, currentUserId } = useFocus()

// Role-based permission checks
const { isWorkspaceAdmin, currentRole, currentWorkspaceId } = useWorkspaces()
const canDeleteItem = computed(() => {
  if (isWorkspaceAdmin.value) return true
  // Item owner can delete
  if (currentUserId.value && itemDetail.value?.ownerId === currentUserId.value) return true
  return false
})
const canEditItem = computed(() => {
  if (isWorkspaceAdmin.value) return true
  if (currentRole.value === 'VIEWER') return false
  return true
})

// Current item ID (allows in-modal navigation)
const currentItemId = ref<string | null>(null)

// Navigation history for back button
const navigationHistory = ref<string[]>([])

// Item detail fetched via $fetch when item changes
const itemDetail = ref<any>(null)
const parentDetail = ref<any>(null)

const loadItem = async (itemId: string, addToHistory = true) => {
  if (!itemId) return
  
  // Add current item to history before navigating (if we have one)
  if (addToHistory && currentItemId.value && currentItemId.value !== itemId) {
    navigationHistory.value.push(currentItemId.value)
  }
  
  currentItemId.value = itemId
  
  try {
    itemDetail.value = await $fetch(`/api/items/${itemId}`)
    
    // Use parent from API response
    parentDetail.value = itemDetail.value?.parent ?? null
  } catch (e) {
    console.error('Failed to fetch item details:', e)
  }
}

const refreshItem = async () => {
  if (currentItemId.value) {
    await loadItem(currentItemId.value, false)
  }
}

// Navigate to parent or child within modal
const navigateToItem = (itemId: string) => {
  loadItem(itemId)
}

// Go back in navigation history
const navigateBack = () => {
  if (navigationHistory.value.length > 0) {
    const previousId = navigationHistory.value.pop()
    if (previousId) {
      loadItem(previousId, false)
    }
  }
}

// Check if parent is a project (has no parent itself)
const isParentProject = computed(() => {
  return parentDetail.value && !parentDetail.value.parentId
})

// Can promote if item has a parent (is not at root level)
const canPromote = computed(() => {
  return parentDetail.value !== null
})

// Get the grandparent ID (parent's parent) for promotion target
const promoteTargetId = computed(() => {
  return parentDetail.value?.parentId ?? null // null means promote to root level
})

// Promote item up one level (become sibling of current parent)
const promoteItem = async () => {
  if (!currentItemId.value || !canPromote.value) return

  try {
    await $fetch(`/api/items/${currentItemId.value}`, {
      method: 'PATCH',
      body: { parentId: promoteTargetId.value }
    })

    // Emit update to refresh parent list
    emit('update', currentItemId.value, { _saved: true, _close: false })

    // Refresh the item detail to show new parent
    await refreshItem()
  } catch (e) {
    console.error('Failed to promote item:', e)
  }
}

const showForecastDetails = ref(false)
const showDeleteConfirm = ref(false)
const deleteError = ref<string | null>(null)
const isDeleting = ref(false)
const statusError = ref<string | null>(null)
const showCompleteWithChildren = ref(false)
const completeWithChildrenLoading = ref(false)
const completeWithChildrenError = ref<string | null>(null)
const completeWithChildrenSource = ref<'status' | 'focus' | null>(null)
const defaultSubStatusByStatus: Record<string, string | null> = {
  todo: 'backlog',
  in_progress: 'scoping',
  blocked: 'dependency',
  paused: 'on_hold',
  done: null,
}

const hasIncompleteChildren = () => {
  const children = itemDetail.value?.children ?? []
  if ((itemDetail.value?.childrenCount ?? 0) > 0 && children.length === 0) {
    return true
  }
  return children.some((child: any) => child.status !== 'done')
}

const openCompleteWithChildrenModal = (source: 'status' | 'focus') => {
  completeWithChildrenSource.value = source
  showCompleteWithChildren.value = true
  completeWithChildrenError.value = null
}

const handleCompleteWithChildren = async () => {
  if (!currentItemId.value) return
  completeWithChildrenLoading.value = true
  completeWithChildrenError.value = null
  try {
    await $fetch(`/api/items/${currentItemId.value}/complete`, {
      method: 'POST',
      body: { cascade: true, maxDepth: 5 },
    })

    showCompleteWithChildren.value = false
    statusError.value = null
    editedStatus.value = 'done'
    editedProgress.value = 100
    await refreshItem()
    emit('update', currentItemId.value, { _saved: true, _close: false })

    if (completeWithChildrenSource.value === 'focus') {
      await completeTask(undefined, false)
    }
  } catch (e: any) {
    completeWithChildrenError.value = e?.data?.message || e?.message || 'Unable to complete subtasks.'
  } finally {
    completeWithChildrenLoading.value = false
  }
}


// Fetch when item changes OR modal opens
watch([() => props.item?.id, () => props.open], ([id, isOpen]) => {
  if (id && isOpen) {
    navigationHistory.value = [] // Reset history when opening fresh
    loadItem(id, false)
    showDeleteConfirm.value = false
    deleteError.value = null
    statusError.value = null
    showCompleteWithChildren.value = false
    completeWithChildrenError.value = null
    completeWithChildrenSource.value = null
  } else if (!isOpen) {
    // Clear when modal closes
    itemDetail.value = null
    parentDetail.value = null
    currentItemId.value = null
    navigationHistory.value = []
    showDeleteConfirm.value = false
    deleteError.value = null
    statusError.value = null
    showCompleteWithChildren.value = false
    completeWithChildrenError.value = null
    completeWithChildrenSource.value = null
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
const editedSubStatus = ref<string | null>(null)
const editedCategory = ref('')
const editedProgress = ref(0)
const displayProgress = computed(() => editedStatus.value === 'done' ? 100 : editedProgress.value)
const editedConfidence = ref(70)
const editedDueDate = ref('')
const editedStartDate = ref('')
const editedComplexity = ref('')
const editedPriority = ref('')

// Available sub-statuses for current status
const availableSubStatuses = computed(() => {
  return getSubStatusesForStatus(editedStatus.value)
})

// UI state
const showOwnerDropdown = ref(false)
const showAssigneeDropdown = ref(false)
const showComplexityDropdown = ref(false)
const showPriorityDropdown = ref(false)
const descriptionRef = ref<HTMLTextAreaElement | null>(null)
const editingDescription = ref(false)
const descriptionExpanded = ref(false)
const descriptionContentRef = ref<HTMLElement | null>(null)
const activeTab = ref<'subtasks' | 'comments'>('subtasks')

// Auto-resize description textarea
const autoResizeDescription = () => {
  if (descriptionRef.value) {
    descriptionRef.value.style.height = 'auto'
    descriptionRef.value.style.height = descriptionRef.value.scrollHeight + 'px'
  }
}

// Check if description content overflows the max height
const descriptionOverflows = computed(() => {
  // Rough heuristic: if content has >6 lines or >400 chars, it likely overflows 150px
  if (!editedDescription.value) return false
  const lineCount = editedDescription.value.split('\n').length
  return lineCount > 6 || editedDescription.value.length > 400
})

const startEditingDescription = () => {
  editingDescription.value = true
  descriptionExpanded.value = false
  nextTick(() => {
    autoResizeDescription()
    descriptionRef.value?.focus()
  })
}

// Trigger resize when description loads
watch(editedDescription, () => {
  if (editingDescription.value) {
    nextTick(autoResizeDescription)
  }
})
const newComment = ref('')
const replyingTo = ref<string | null>(null)
const replyText = ref('')
const isSaving = ref(false)
const saveTimeout = ref<ReturnType<typeof setTimeout> | null>(null)
const hasUnsavedChanges = ref(false)
const isInitializing = ref(true) // Prevent auto-save during initial load

// Owner editing
const editedOwnerId = ref<string | null>(null)

// Track last loaded item ID to avoid resetting tab on refresh
const lastLoadedItemId = ref<string | null>(null)

// Load form data from itemDetail (full API data) when it loads
watch(itemDetail, (detail) => {
  if (detail) {
    isInitializing.value = true
    editedTitle.value = detail.title ?? ''
    editedDescription.value = detail.description ?? ''
    editedStatus.value = detail.status ?? 'todo'
    editedSubStatus.value = detail.subStatus ?? null
    editedCategory.value = detail.category ?? ''
    editedComplexity.value = detail.complexity ?? ''
    editedPriority.value = detail.priority ?? 'MEDIUM'
    editedProgress.value = detail.progress ?? 0
    editedConfidence.value = detail.confidence ?? 70
    editedDueDate.value = detail.dueDate?.split('T')[0] ?? ''
    editedStartDate.value = detail.startDate?.split('T')[0] ?? ''
    editedOwnerId.value = detail.owner?.id ?? null
    editingDescription.value = false
    descriptionExpanded.value = false
    // Only reset tab when navigating to a different item, not on refresh
    if (detail.id !== lastLoadedItemId.value) {
      activeTab.value = (detail.children?.length > 0 || detail.childrenCount > 0) ? 'subtasks' : 'comments'
      lastLoadedItemId.value = detail.id
    }
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
    editedComplexity.value = props.item.complexity ?? ''
    editedPriority.value = props.item.priority ?? 'MEDIUM'
    editedProgress.value = props.item.progress ?? 0
    editedConfidence.value = props.item.confidence ?? 70
    editedDueDate.value = props.item.dueDate?.split('T')[0] ?? ''
    hasUnsavedChanges.value = false
    showAddSubtask.value = false
    newSubtaskTitle.value = ''
  } else if (!isOpen) {
    lastLoadedItemId.value = null
  }
})


const formatShortDate = (dateStr?: string | null) => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const riskLevel = computed(() => {
  if (!estimatedCompletion.value || estimatedCompletion.value.complete) return 'low'
  if (estimatedCompletion.value.missProb > 66) return 'high'
  if (estimatedCompletion.value.missProb > 33) return 'medium'
  return 'low'
})

const riskLabel = computed(() => {
  if (riskLevel.value === 'high') return 'High risk'
  if (riskLevel.value === 'medium') return 'At risk'
  return 'Low risk'
})

const riskClasses = computed(() => {
  if (riskLevel.value === 'high') return 'bg-rose-100 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
  if (riskLevel.value === 'medium') return 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400'
  return 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
})

const rangeClasses = computed(() => {
  if (riskLevel.value === 'high') return 'from-rose-400/70 to-red-500/70'
  if (riskLevel.value === 'medium') return 'from-amber-400/70 to-orange-400/70'
  return 'from-emerald-400/70 to-teal-400/70'
})

const dueMarkerClasses = computed(() => {
  return 'bg-slate-600'
})

const forecastBar = computed(() => {
  if (!estimatedCompletion.value || estimatedCompletion.value.complete) return null
  const earliest = estimatedCompletion.value.earliestRaw
  const latest = estimatedCompletion.value.latestRaw
  if (!earliest || !latest) return null

  const now = new Date()
  const due = editedDueDate.value ? new Date(editedDueDate.value) : null
  let end = latest
  if (due && due > end) end = due
  if (end <= now) end = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const total = end.getTime() - now.getTime()
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
  const toPct = (date: Date) => clamp(((date.getTime() - now.getTime()) / total) * 100, 0, 100)

  const rangeLeft = toPct(earliest)
  const rangeRight = toPct(latest)
  let rangeWidth = Math.max(6, rangeRight - rangeLeft)
  if (rangeLeft + rangeWidth > 100) rangeWidth = 100 - rangeLeft

  const basePos = toPct(estimatedCompletion.value.baseDateRaw ?? latest)
  const duePos = due ? toPct(due) : null

  return { rangeLeft, rangeWidth, basePos, duePos }
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
    earliestRaw: earliest,
    latest: formatDate(latest),
    latestRaw: latest,
    bandDays,
    isExact: confidence >= 95,
    velocity: Math.round(progress / daysSpent * 10) / 10,
    missProb,
    daysUntilDue,
  }
})

// Auto-save with debounce
const saveChanges = async () => {
  if (!currentItemId.value || !props.open) return
  isSaving.value = true

  const payload = {
    title: editedTitle.value,
    description: editedDescription.value,
    status: editedStatus.value,
    subStatus: editedSubStatus.value,
    category: editedCategory.value,
    complexity: editedComplexity.value || null,
    priority: editedPriority.value || null,
    progress: editedProgress.value,
    confidence: editedConfidence.value,
    dueDate: editedDueDate.value || null,
    startDate: editedStartDate.value || null,
    ownerId: editedOwnerId.value,
  }

  try {
    await $fetch(`/api/items/${currentItemId.value}`, {
      method: 'PATCH',
      body: payload
    })
    hasUnsavedChanges.value = false
    // Emit update to refresh parent list (don't close modal)
    emit('update', currentItemId.value, { _saved: true, _close: false })
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

  if (newStatus === 'done' && oldStatus !== 'done') {
    if (hasIncompleteChildren()) {
      editedStatus.value = oldStatus
      openCompleteWithChildrenModal('status')
      return
    }
    statusError.value = null
  } else if (statusError.value) {
    statusError.value = null
  }
  
  if (oldStatus && newStatus !== oldStatus) {
    if (newStatus === 'done') {
      editedSubStatus.value = null
    } else {
      const validSubStatuses = getSubStatusesForStatus(newStatus)
      const currentSubStatus = editedSubStatus.value
      if (!currentSubStatus || !validSubStatuses[currentSubStatus as keyof typeof validSubStatuses]) {
        editedSubStatus.value = defaultSubStatusByStatus[newStatus] ?? null
      }
    }
  }
  
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

// Watch subStatus changes for auto-save
watch(editedSubStatus, () => {
  if (props.open && itemDetail.value && !isInitializing.value) {
    debouncedSave()
  }
})

// Watch all fields for auto-save (debounced)
watch([editedTitle, editedDescription, editedCategory, editedComplexity, editedPriority, editedDueDate, editedStartDate], () => {
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
  emit('update', currentItemId.value ?? props.item?.id ?? '', { _close: true })
  emit('close')
}

// Delete item
const deleteItem = async () => {
  if (!currentItemId.value) return

  const parentId = itemDetail.value?.parentId ?? null

  isDeleting.value = true
  deleteError.value = null
  try {
    await $fetch(`/api/items/${currentItemId.value}`, {
      method: 'DELETE',
    })
    emit('deleted', currentItemId.value)
    emit('close')

    // Navigate to parent item page, or workspace root if top-level project
    if (parentId) {
      router.push(`/workspace/projects/${parentId}`)
    } else {
      router.push('/workspace')
    }
  } catch (e: any) {
    console.error('Failed to delete item:', e)
    deleteError.value = e.data?.message || 'Failed to delete item'
  } finally {
    isDeleting.value = false
  }
}

// Assign user
const assignUser = async (userId: string) => {
  if (!currentItemId.value) return
  try {
    await $fetch(`/api/items/${currentItemId.value}/assignees`, {
      method: 'POST',
      body: { userId }
    })
    await refreshItem()
  } catch (e) {
    console.error('Failed to assign user:', e)
  }
}

// Remove assignee
const removeAssignee = async (userId: string) => {
  if (!currentItemId.value) return
  try {
    await $fetch(`/api/items/${currentItemId.value}/assignees/${userId}`, {
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

// Add subtask inline
const showAddSubtask = ref(false)
const newSubtaskTitle = ref('')
const addingSubtask = ref(false)
const addSubtaskInput = ref<HTMLInputElement | null>(null)

const startAddSubtask = () => {
  showAddSubtask.value = true
  newSubtaskTitle.value = ''
  nextTick(() => addSubtaskInput.value?.focus())
}

const cancelAddSubtask = () => {
  showAddSubtask.value = false
  newSubtaskTitle.value = ''
}

const submitSubtask = async () => {
  const title = newSubtaskTitle.value.trim()
  const parentId = itemDetail.value?.id
  if (!title || !parentId || !currentWorkspaceId.value) return
  addingSubtask.value = true
  try {
    await $fetch('/api/items', {
      method: 'POST',
      body: {
        workspaceId: currentWorkspaceId.value,
        parentId,
        title,
      }
    })
    newSubtaskTitle.value = ''
    await refreshItem()
    nextTick(() => addSubtaskInput.value?.focus())
  } catch (e) {
    console.error('Failed to create subtask:', e)
  } finally {
    addingSubtask.value = false
  }
}

// Comments
const submitComment = async () => {
  if (!newComment.value.trim() || !currentItemId.value) return

  try {
    await $fetch(`/api/items/${currentItemId.value}/comments`, {
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
  if (!replyText.value.trim() || !currentItemId.value) return

  try {
    await $fetch(`/api/items/${currentItemId.value}/comments`, {
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

// View full board - navigates to the currently displayed item's board
const handleViewFull = () => {
  if (itemDetail.value) {
    emit('viewFull', itemDetail.value)
    emit('close')
  }
}

const handleCompleteFocus = async () => {
  try {
    await completeTask()
  } catch (e: any) {
    const message = e?.data?.message || e?.message || 'Unable to complete task.'
    if (message.includes('incomplete child')) {
      openCompleteWithChildrenModal('focus')
    } else {
      statusError.value = message
    }
  }
}

// Status options
const statusOptions = Object.entries(STATUS_CONFIG).map(([key, config]) => ({
  value: key,
  label: config.label,
}))

// Category options
const categoryOptions = Object.keys(CATEGORY_COLORS)
const complexityOptions = COMPLEXITY_OPTIONS
const priorityOptions = PRIORITY_OPTIONS

const categoryDotColors: Record<string, string> = {
  Engineering: 'bg-blue-500',
  Bug: 'bg-rose-500',
  Design: 'bg-violet-500',
  Product: 'bg-indigo-500',
  QA: 'bg-amber-500',
  Research: 'bg-cyan-500',
  Operations: 'bg-orange-500',
  Marketing: 'bg-pink-500',
}

const complexityDotColors: Record<string, string> = {
  TRIVIAL: 'bg-emerald-500',
  SMALL: 'bg-green-500',
  MEDIUM: 'bg-amber-500',
  LARGE: 'bg-orange-500',
  EPIC: 'bg-rose-500',
}

const complexityLabel = computed(() => {
  return complexityOptions.find(opt => opt.value === editedComplexity.value)?.label ?? 'No complexity'
})

const priorityDotColors: Record<string, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-rose-500',
}

const priorityLabel = computed(() => {
  return priorityOptions.find(opt => opt.value === editedPriority.value)?.label ?? 'Medium'
})

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

// Close dropdowns when clicking outside
const ownerDropdownRef = ref<HTMLElement | null>(null)
const assigneeDropdownRef = ref<HTMLElement | null>(null)
const complexityDropdownRef = ref<HTMLElement | null>(null)
const priorityDropdownRef = ref<HTMLElement | null>(null)
onMounted(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (ownerDropdownRef.value && !ownerDropdownRef.value.contains(e.target as Node)) {
      showOwnerDropdown.value = false
    }
    if (assigneeDropdownRef.value && !assigneeDropdownRef.value.contains(e.target as Node)) {
      showAssigneeDropdown.value = false
    }
    if (complexityDropdownRef.value && !complexityDropdownRef.value.contains(e.target as Node)) {
      showComplexityDropdown.value = false
    }
    if (priorityDropdownRef.value && !priorityDropdownRef.value.contains(e.target as Node)) {
      showPriorityDropdown.value = false
    }
  }
  document.addEventListener('click', handleClickOutside)
  onUnmounted(() => document.removeEventListener('click', handleClickOutside))
})

// Update owner
const updateOwner = async (userId: string | null) => {
  editedOwnerId.value = userId
  showOwnerDropdown.value = false
  await immediateSave()
  await refreshItem()
}

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
        class="fixed inset-0 z-50 flex justify-end"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/40"
          @click="handleClose"
        />

        <!-- Slide-in Panel -->
        <div class="panel relative bg-white dark:bg-dm-card shadow-2xl w-full max-w-xl 2xl:max-w-2xl h-full flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <div class="flex items-center gap-2">
              <!-- Back button (when navigated within modal) -->
              <button
                v-if="navigationHistory.length > 0"
                @click="navigateBack"
                class="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-white/[0.06] rounded-md transition-colors"
              >
                <Icon name="heroicons:arrow-left" class="w-3.5 h-3.5" />
                Back
              </button>

              <!-- Status + Stage Pill (cascading) -->
              <div class="group/status relative">
                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card cursor-pointer transition-all duration-150 group-hover/status:border-slate-300 dark:group-hover/status:border-white/[0.1] group-hover/status:shadow-sm">
                  <div
                    class="w-1.5 h-1.5 rounded-full"
                    :class="{
                      'bg-slate-400': editedStatus === 'todo',
                      'bg-blue-500': editedStatus === 'in_progress',
                      'bg-rose-500': editedStatus === 'blocked',
                      'bg-amber-500': editedStatus === 'paused',
                      'bg-emerald-500': editedStatus === 'done',
                    }"
                  />
                  <span class="text-xs font-normal text-slate-600 dark:text-zinc-400">
                    {{ STATUS_CONFIG[editedStatus as keyof typeof STATUS_CONFIG]?.label || 'Status' }}
                    <template v-if="editedSubStatus && SUB_STATUS_CONFIG[editedSubStatus]">
                      <span class="text-slate-300 dark:text-zinc-600 mx-0.5">/</span>
                      {{ SUB_STATUS_CONFIG[editedSubStatus].label }}
                    </template>
                  </span>
                  <Icon name="heroicons:chevron-down" class="w-3 h-3 text-slate-400 transition-transform duration-150 group-hover/status:rotate-180" />
                </div>
                <!-- Dropdown -->
                <div class="absolute top-full left-0 mt-1 bg-white dark:bg-dm-card rounded-lg border border-slate-200 dark:border-white/[0.06] shadow-lg z-30 opacity-0 invisible translate-y-[-4px] transition-all duration-150 group-hover/status:opacity-100 group-hover/status:visible group-hover/status:translate-y-0 min-w-[130px]">
                  <div class="py-1">
                    <div
                      v-for="opt in statusOptions"
                      :key="opt.value"
                      class="group/row relative"
                    >
                      <button
                        @click="editedStatus = opt.value; if (opt.value === 'done') editedSubStatus = null"
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                        :class="editedStatus === opt.value
                          ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                          : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
                      >
                        <div
                          class="w-1.5 h-1.5 rounded-full"
                          :class="{
                            'bg-slate-400': opt.value === 'todo',
                            'bg-blue-500': opt.value === 'in_progress',
                            'bg-rose-500': opt.value === 'blocked',
                            'bg-amber-500': opt.value === 'paused',
                            'bg-emerald-500': opt.value === 'done',
                          }"
                        />
                        <span class="flex-1 text-left">{{ opt.label }}</span>
                        <Icon
                          v-if="opt.value !== 'done'"
                          name="heroicons:chevron-right"
                          class="w-3 h-3 text-slate-300 dark:text-zinc-600"
                        />
                      </button>
                      <!-- Sub-status flyout -->
                      <div
                        v-if="opt.value !== 'done' && Object.keys(SUB_STATUS_BY_STATUS[opt.value as keyof typeof SUB_STATUS_BY_STATUS] ?? {}).length > 0"
                        class="absolute left-full top-0 ml-1 bg-white dark:bg-dm-card rounded-lg border border-slate-200 dark:border-white/[0.06] shadow-lg min-w-[140px] py-1 z-30 opacity-0 invisible transition-all duration-100 group-hover/row:opacity-100 group-hover/row:visible"
                      >
                        <button
                          @click="editedStatus = opt.value; editedSubStatus = null"
                          class="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                          :class="editedStatus === opt.value && !editedSubStatus
                            ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                            : 'text-slate-500 dark:text-zinc-500 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
                        >
                          <div class="w-3 h-3 rounded-full border border-dashed border-slate-300 dark:border-white/[0.1]" />
                          <span>None</span>
                        </button>
                        <button
                          v-for="(config, key) in (SUB_STATUS_BY_STATUS[opt.value as keyof typeof SUB_STATUS_BY_STATUS] ?? {})"
                          :key="key"
                          @click="editedStatus = opt.value; editedSubStatus = key as string"
                          class="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                          :class="editedStatus === opt.value && editedSubStatus === key
                            ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                            : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
                        >
                          <Icon :name="config.icon" class="w-3 h-3 text-slate-500" />
                          <span>{{ config.label }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Category Pill -->
              <div class="group/category relative">
                <div
                  class="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-dm-card cursor-pointer transition-all duration-150 group-hover/category:border-slate-300 dark:group-hover/category:border-white/[0.1] group-hover/category:shadow-sm"
                >
                  <div
                    class="w-1.5 h-1.5 rounded-full"
                    :class="editedCategory ? (categoryDotColors[editedCategory] || 'bg-slate-400') : 'bg-slate-300'"
                  />
                  <span class="text-xs font-normal text-slate-600 dark:text-zinc-400">{{ editedCategory || 'Category' }}</span>
                  <Icon name="heroicons:chevron-down" class="w-3 h-3 text-slate-400 transition-transform duration-150 group-hover/category:rotate-180" />
                </div>
                <div class="absolute top-full left-0 mt-1 bg-white dark:bg-dm-card rounded-lg border border-slate-200 dark:border-white/[0.06] shadow-lg overflow-hidden z-30 min-w-[160px] max-h-56 overflow-y-auto opacity-0 invisible translate-y-[-4px] transition-all duration-150 group-hover/category:opacity-100 group-hover/category:visible group-hover/category:translate-y-0">
                  <div class="py-1">
                    <button
                      @click="editedCategory = ''"
                      class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                      :class="!editedCategory
                        ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
                    >
                      <div class="w-2 h-2 rounded-full bg-slate-300" />
                      <span>No category</span>
                    </button>
                    <div class="border-t border-slate-100 dark:border-white/[0.06] my-1" />
                    <button
                      v-for="cat in categoryOptions"
                      :key="cat"
                      @click="editedCategory = cat"
                      class="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors"
                      :class="editedCategory === cat
                        ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium'
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06]'"
                    >
                      <div class="w-2 h-2 rounded-full" :class="categoryDotColors[cat] || 'bg-slate-400'" />
                      <span>{{ cat }}</span>
                    </button>
                  </div>
                </div>
              </div>

            </div>
            
            <div class="flex items-center gap-2">
              <!-- Focus Button -->
              <button
                v-if="!isFocusedOnTask(item.id)"
                @click="startTaskFocus(item.id)"
                :disabled="focusLoading"
                class="w-8 h-8 flex items-center justify-center rounded-md text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                title="Start focus"
              >
                <Icon name="heroicons:bolt" class="w-4 h-4" />
              </button>
              <button
                v-else
                @click="handleCompleteFocus"
                :disabled="focusLoading"
                class="w-8 h-8 flex items-center justify-center rounded-md text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                title="Complete focus"
              >
                <Icon name="heroicons:check" class="w-4 h-4" />
              </button>

              <!-- Auto-save indicator -->
              <span v-if="isSaving" class="flex items-center gap-1 text-xs text-slate-400">
                <Icon name="heroicons:arrow-path" class="w-3 h-3 animate-spin" />
              </span>
              <span v-else-if="hasUnsavedChanges" class="text-[10px] text-amber-500">unsaved</span>

              <!-- View Full Board -->
              <button
                @click="handleViewFull"
                class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:text-blue-400 dark:hover:bg-white/[0.06] transition-colors"
                title="View Full Board"
              >
                <Icon name="heroicons:arrows-pointing-out" class="w-4 h-4" />
              </button>

              <!-- Close button -->
              <button
                @click="handleClose"
                class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] transition-colors"
              >
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <!-- Content -->
          <div class="p-6 space-y-6 flex-1 overflow-y-auto overflow-x-hidden">
            <div v-if="statusError" class="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
              {{ statusError }}
            </div>
            <!-- Title -->
            <input
              v-model="editedTitle"
              type="text"
              class="w-full text-xl font-medium text-slate-900 dark:text-zinc-100 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-slate-300 dark:placeholder-zinc-600"
              placeholder="Task title..."
            />
            
            <!-- Description -->
            <div v-if="!editingDescription">
              <div v-if="editedDescription" class="relative">
                <div
                  ref="descriptionContentRef"
                  class="relative cursor-text rounded px-1 -mx-1 py-0.5 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                  :class="!descriptionExpanded && descriptionOverflows ? 'max-h-[220px] overflow-hidden' : ''"
                  @click="startEditingDescription"
                >
                  <MarkdownRenderer
                    :content="editedDescription"
                    class="text-sm text-slate-600 dark:text-zinc-400"
                  />
                  <!-- Fade overlay when collapsed -->
                  <div
                    v-if="!descriptionExpanded && descriptionOverflows"
                    class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-dm-card pointer-events-none rounded-b"
                  />
                </div>
                <button
                  v-if="!descriptionExpanded && descriptionOverflows"
                  @click.stop="descriptionExpanded = true"
                  class="mt-1 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                >
                  View full description
                </button>
                <button
                  v-else-if="descriptionExpanded && descriptionOverflows"
                  @click.stop="descriptionExpanded = false"
                  class="mt-1 text-xs text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                >
                  Show less
                </button>
              </div>
              <p
                v-else
                class="text-sm text-slate-400 cursor-text hover:bg-slate-50 dark:hover:bg-white/[0.06] rounded px-1 -mx-1 py-0.5 transition-colors"
                @click="startEditingDescription"
              >
                Add a description...
              </p>
            </div>
            <textarea
              v-else
              ref="descriptionRef"
              v-model="editedDescription"
              rows="3"
              class="w-full text-sm text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-white/[0.04] rounded-lg px-3 py-2 border border-slate-200 dark:border-white/[0.06] focus:outline-none focus:border-slate-300 dark:focus:border-white/[0.1] focus:ring-0 resize-none placeholder-slate-400 dark:placeholder-zinc-600 font-mono"
              placeholder="Add a description... (supports Markdown)"
              @input="autoResizeDescription"
              @blur="editingDescription = false"
            />

            <!-- Inline Documents Section -->
            <DocumentsSection
              v-if="itemDetail?.documentCount > 0"
              :item-id="itemDetail?.id ?? null"
              :show-header="false"
              :show-helper="false"
              :show-new-button="false"
              grid-cols="grid-cols-2"
            />

            <!-- Property Table -->
            <div class="divide-y divide-slate-100 dark:divide-white/[0.04]">
              <!-- Priority -->
              <div class="flex items-center py-2.5">
                <span class="w-28 text-xs text-slate-500 dark:text-zinc-500 flex-shrink-0">Priority</span>
                <div class="flex-1 min-w-0 relative" ref="priorityDropdownRef">
                  <button
                    @click.stop="showPriorityDropdown = !showPriorityDropdown"
                    class="flex items-center gap-2 py-0.5 text-sm text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="priorityDotColors[editedPriority] || 'bg-slate-300'"
                    />
                    <span>{{ priorityLabel }}</span>
                    <Icon name="heroicons:chevron-down" class="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <Transition name="dropdown">
                    <div
                      v-if="showPriorityDropdown"
                      class="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-dm-card rounded-lg shadow-lg border border-slate-200 dark:border-white/[0.06] py-1 z-10"
                    >
                      <button
                        v-for="opt in priorityOptions"
                        :key="opt.value"
                        @click="editedPriority = opt.value; showPriorityDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                        :class="editedPriority === opt.value ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium' : ''"
                      >
                        <div class="w-2 h-2 rounded-full" :class="priorityDotColors[opt.value] || 'bg-slate-400'" />
                        <span>{{ opt.label }}</span>
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>

              <!-- Complexity -->
              <div class="flex items-center py-2.5">
                <span class="w-28 text-xs text-slate-500 dark:text-zinc-500 flex-shrink-0">Complexity</span>
                <div class="flex-1 min-w-0 relative" ref="complexityDropdownRef">
                  <button
                    @click.stop="showComplexityDropdown = !showComplexityDropdown"
                    class="flex items-center gap-2 py-0.5 text-sm text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
                  >
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="editedComplexity ? (complexityDotColors[editedComplexity] || 'bg-slate-400') : 'bg-slate-300'"
                    />
                    <span>{{ complexityLabel }}</span>
                    <Icon name="heroicons:chevron-down" class="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <Transition name="dropdown">
                    <div
                      v-if="showComplexityDropdown"
                      class="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-dm-card rounded-lg shadow-lg border border-slate-200 dark:border-white/[0.06] py-1 z-10"
                    >
                      <button
                        @click="editedComplexity = ''; showComplexityDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                        :class="!editedComplexity ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium' : ''"
                      >
                        <div class="w-2 h-2 rounded-full bg-slate-300" />
                        <span>No complexity</span>
                      </button>
                      <div class="border-t border-slate-100 dark:border-white/[0.06] my-1" />
                      <button
                        v-for="opt in complexityOptions"
                        :key="opt.value"
                        @click="editedComplexity = opt.value; showComplexityDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                        :class="editedComplexity === opt.value ? 'bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 font-medium' : ''"
                      >
                        <div class="w-2 h-2 rounded-full" :class="complexityDotColors[opt.value] || 'bg-slate-400'" />
                        <span>{{ opt.label }}</span>
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>

              <!-- Owner -->
              <div class="flex items-center py-2.5">
                <span class="w-28 text-xs text-slate-500 dark:text-zinc-500 flex-shrink-0">Owner</span>
                <div class="flex-1 min-w-0 relative" ref="ownerDropdownRef">
                  <button
                    @click.stop="canEditItem && (showOwnerDropdown = !showOwnerDropdown)"
                    :class="[
                      'flex items-center gap-2 py-0.5 text-sm transition-colors',
                      canEditItem ? 'cursor-pointer hover:text-slate-900 dark:hover:text-zinc-100' : 'cursor-default'
                    ]"
                  >
                    <template v-if="itemDetail?.owner">
                      <div class="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <span class="text-[9px] text-white font-medium">{{ itemDetail.owner.name?.[0] ?? 'U' }}</span>
                      </div>
                      <span class="text-slate-700 dark:text-zinc-300">{{ itemDetail.owner.name }}</span>
                    </template>
                    <template v-else>
                      <div class="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center">
                        <Icon name="heroicons:user" class="w-3 h-3 text-slate-400" />
                      </div>
                      <span class="text-slate-400">No owner</span>
                    </template>
                    <Icon v-if="canEditItem" name="heroicons:chevron-down" class="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <Transition name="dropdown">
                    <div
                      v-if="showOwnerDropdown"
                      class="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-dm-card rounded-lg shadow-lg border border-slate-200 dark:border-white/[0.06] py-1 z-10 max-h-48 overflow-y-auto"
                    >
                      <button
                        v-if="itemDetail?.owner"
                        @click="updateOwner(null)"
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <Icon name="heroicons:x-mark" class="w-4 h-4 text-slate-400" />
                        <span>Remove owner</span>
                      </button>
                      <div v-if="itemDetail?.owner" class="border-t border-slate-100 dark:border-white/[0.06] my-1" />
                      <button
                        v-for="user in availableUsers"
                        :key="user.id"
                        @click="updateOwner(user.id)"
                        class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                        :class="{ 'bg-amber-50 dark:bg-amber-500/10': user.id === editedOwnerId }"
                      >
                        <div class="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                          <span class="text-[9px] text-white font-medium">{{ user.name?.[0] ?? 'U' }}</span>
                        </div>
                        <span>{{ user.name }}</span>
                        <Icon v-if="user.id === editedOwnerId" name="heroicons:check" class="w-4 h-4 text-amber-500 ml-auto" />
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>

              <!-- Assignees -->
              <div class="flex items-start py-2.5">
                <span class="w-28 text-xs text-slate-500 dark:text-zinc-500 flex-shrink-0 pt-0.5">Assignees</span>
                <div class="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
                  <template v-if="itemDetail?.assignees?.length">
                    <div
                      v-for="assignee in itemDetail.assignees"
                      :key="assignee.id"
                      class="group flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.06] rounded-full text-xs text-slate-700 dark:text-zinc-300 max-w-full"
                    >
                      <div class="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                        <span class="text-[8px] text-white font-medium">{{ assignee.name?.[0] ?? 'U' }}</span>
                      </div>
                      <span class="truncate">{{ assignee.name }}</span>
                      <button
                        v-if="canEditItem"
                        @click="removeAssignee(assignee.id)"
                        class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 dark:hover:bg-white/[0.08] rounded transition-all"
                      >
                        <Icon name="heroicons:x-mark" class="w-3 h-3 text-slate-400" />
                      </button>
                    </div>
                  </template>
                  <div v-if="canEditItem" class="relative" ref="assigneeDropdownRef">
                    <button
                      @click.stop="showAssigneeDropdown = !showAssigneeDropdown"
                      class="flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                    >
                      <Icon name="heroicons:plus" class="w-3 h-3" />
                      Add
                    </button>
                    <Transition name="dropdown">
                      <div
                        v-if="showAssigneeDropdown"
                        class="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-dm-card rounded-lg shadow-lg border border-slate-200 dark:border-white/[0.06] py-1 z-10"
                      >
                        <div v-if="unassignedUsers.length === 0" class="px-3 py-2 text-xs text-slate-400">
                          No more users to add
                        </div>
                        <button
                          v-for="user in unassignedUsers"
                          :key="user.id"
                          @click="assignUser(user.id)"
                          class="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                        >
                          <div class="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                            <span class="text-[9px] text-white font-medium">{{ user.name?.[0] ?? 'U' }}</span>
                          </div>
                          <span>{{ user.name }}</span>
                        </button>
                      </div>
                    </Transition>
                  </div>
                </div>
              </div>

              <!-- Start Date -->
              <div class="flex items-center py-2.5">
                <span class="w-28 text-xs text-slate-500 dark:text-zinc-500 flex-shrink-0">Started</span>
                <div class="flex-1 min-w-0">
                  <input
                    v-model="editedStartDate"
                    type="date"
                    class="text-sm bg-transparent border-0 p-0 text-slate-700 dark:text-zinc-300 dark-date-input focus:outline-none focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>

              <!-- Due Date -->
              <div class="flex items-center py-2.5">
                <span class="w-28 text-xs text-slate-500 dark:text-zinc-500 flex-shrink-0">Due</span>
                <div class="flex-1 min-w-0">
                  <input
                    v-model="editedDueDate"
                    type="date"
                    class="text-sm bg-transparent border-0 p-0 text-slate-700 dark:text-zinc-300 dark-date-input focus:outline-none focus:ring-0 cursor-pointer"
                    :class="editedDueDate && new Date(editedDueDate) < new Date() ? 'text-rose-600 dark:text-rose-400' : ''"
                  />
                </div>
              </div>

              <!-- Progress -->
              <div class="flex items-center py-2.5">
                <span class="w-28 text-xs text-slate-500 dark:text-zinc-500 flex-shrink-0">Progress</span>
                <div class="flex-1 min-w-0 flex items-center gap-3">
                  <div class="relative flex-1">
                    <div class="h-1.5 bg-slate-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
                      <div
                        class="h-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all"
                        :style="{ width: `${displayProgress}%` }"
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
                  <span class="text-xs font-medium text-slate-700 dark:text-zinc-300 w-8 text-right tabular-nums">{{ displayProgress }}%</span>
                </div>
              </div>

              <!-- Confidence -->
              <div class="flex items-center py-2.5">
                <span class="w-28 text-xs text-slate-500 dark:text-zinc-500 flex-shrink-0">Confidence</span>
                <div class="flex-1 min-w-0 flex items-center gap-3">
                  <div class="relative flex-1">
                    <div class="h-1.5 bg-slate-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
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
                  <span class="text-xs font-medium text-slate-700 dark:text-zinc-300 w-8 text-right tabular-nums">{{ editedConfidence }}%</span>
                </div>
              </div>
            </div>
            
            <!-- Forecast Card -->
            <!-- Completed state (has estimatedCompletion or status is done) -->
            <div v-if="editedStatus === 'done'" class="rounded-xl p-4 border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                    <Icon name="heroicons:check-circle" class="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div class="text-sm font-medium text-emerald-800 dark:text-emerald-300">Completed</div>
                    <div v-if="itemDetail?.completedAt" class="text-xs text-emerald-600/70 dark:text-emerald-400/60">
                      {{ formatShortDate(itemDetail.completedAt) }}
                    </div>
                  </div>
                </div>
                <div class="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full">
                  100%
                </div>
              </div>
            </div>

            <div v-else-if="estimatedCompletion" class="rounded-xl p-4 border border-slate-200 dark:border-white/[0.06]">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-[10px] uppercase tracking-wider text-slate-400">Forecast</div>
                  <div class="text-sm font-medium text-slate-800 dark:text-zinc-200">
                    Est. finish: {{ estimatedCompletion.isExact ? estimatedCompletion.baseDate : `${estimatedCompletion.earliest} – ${estimatedCompletion.latest}` }}
                  </div>
                  <div class="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span v-if="editedDueDate">Due {{ formatShortDate(editedDueDate) }}</span>
                    <span v-if="editedDueDate">•</span>
                    <span :class="['px-2 py-0.5 rounded-full text-[10px] font-medium', riskClasses]">
                      {{ riskLabel }}
                    </span>
                  </div>
                </div>
                <button
                  class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 transition-colors"
                  @click="showForecastDetails = !showForecastDetails"
                >
                  {{ showForecastDetails ? 'Hide details' : 'Details' }}
                </button>
              </div>

              <div class="mt-4">
                <div class="relative h-2 rounded-full bg-slate-100 dark:bg-white/[0.08] overflow-hidden">
                  <div
                    v-if="forecastBar"
                    class="absolute inset-y-0 rounded-full bg-gradient-to-r"
                    :class="rangeClasses"
                    :style="{ left: `${forecastBar.rangeLeft}%`, width: `${forecastBar.rangeWidth}%` }"
                  />
                  <div
                    v-if="forecastBar"
                    class="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-slate-700 dark:bg-zinc-300 shadow"
                    :style="{ left: `calc(${forecastBar.basePos}% - 4px)` }"
                  />
                  <div
                    v-if="forecastBar && forecastBar.duePos !== null"
                    class="absolute -top-1 w-[2px] h-4"
                    :class="dueMarkerClasses"
                    :style="{ left: `calc(${forecastBar.duePos}% - 1px)` }"
                  />
                </div>
                <div class="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Now</span>
                  <span v-if="editedDueDate">Due {{ formatShortDate(editedDueDate) }}</span>
                  <span v-else>—</span>
                </div>
              </div>

              <div v-if="showForecastDetails" class="mt-4 space-y-3">
                <div class="grid grid-cols-3 gap-2 text-center">
                  <div class="bg-slate-50 dark:bg-white/[0.04] rounded-lg p-2">
                    <div class="text-sm font-semibold text-slate-700 dark:text-zinc-300">{{ estimatedCompletion.daysSpent }}</div>
                    <div class="text-[10px] uppercase tracking-wide text-slate-400">Spent</div>
                  </div>
                  <div class="bg-slate-50 dark:bg-white/[0.04] rounded-lg p-2">
                    <div class="text-sm font-semibold text-slate-700 dark:text-zinc-300">{{ estimatedCompletion.totalEstimate }}</div>
                    <div class="text-[10px] uppercase tracking-wide text-slate-400">Total</div>
                  </div>
                  <div class="bg-slate-50 dark:bg-white/[0.04] rounded-lg p-2">
                    <div class="text-sm font-semibold text-slate-700 dark:text-zinc-300">{{ estimatedCompletion.remainingDays }}</div>
                    <div class="text-[10px] uppercase tracking-wide text-slate-400">Left</div>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                  <span v-if="!estimatedCompletion.isExact">
                    ±{{ Math.floor(estimatedCompletion.bandDays / 2) }}d @ {{ editedConfidence }}% confidence
                  </span>
                  <span>•</span>
                  <span>Miss risk {{ estimatedCompletion.missProb }}%</span>
                </div>

                <div v-if="editedDueDate" class="text-[11px] text-slate-500">
                  Due in {{ estimatedCompletion.daysUntilDue }} days, est. {{ estimatedCompletion.remainingDays }} days remaining
                </div>

                <div class="text-[11px] text-slate-500">
                  {{ displayProgress }}% over {{ estimatedCompletion.daysSpent }} days = {{ estimatedCompletion.velocity }}%/day velocity {{ estimatedCompletion.missProb <= 33 ? '✨' : '' }}
                </div>
              </div>
            </div>
            
            <!-- No estimate message -->
            <div v-else-if="editedDueDate" class="bg-slate-50 dark:bg-white/[0.04] rounded-xl p-4 border border-dashed border-slate-200 dark:border-white/[0.06] text-center">
              <Icon name="heroicons:calculator" class="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <p class="text-xs text-slate-400">Needs estimate. Add a start date and progress to see completion.</p>
            </div>
            <div v-else class="bg-slate-50 dark:bg-white/[0.04] rounded-xl p-4 border border-dashed border-slate-200 dark:border-white/[0.06] text-center">
              <Icon name="heroicons:calculator" class="w-6 h-6 text-slate-300 mx-auto mb-2" />
              <p class="text-xs text-slate-400">Add a start date and progress to see a forecast.</p>
            </div>

            <!-- Parent Section -->
            <div v-if="parentDetail" class="mb-6">
              <div class="flex items-center justify-between mb-2">
                <h3 class="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {{ isParentProject ? 'Parent Project' : 'Parent Task' }}
                </h3>
                <div class="flex items-center gap-1">
                  <!-- View from parent -->
                  <button
                    @click.stop="emit('viewFull', parentDetail); emit('close')"
                    class="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] rounded transition-colors"
                    title="View in parent's board"
                  >
                    <Icon name="heroicons:arrows-pointing-out" class="w-3.5 h-3.5" />
                    View board
                  </button>
                  <!-- Promote Button -->
                  <button
                    v-if="canPromote"
                    @click.stop="promoteItem"
                    class="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] rounded transition-colors"
                    title="Move up one level (become sibling of parent)"
                  >
                    <Icon name="heroicons:arrow-up-on-square" class="w-3.5 h-3.5" />
                    Promote
                  </button>
                </div>
              </div>
              <div
                class="group flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer"
                :class="isParentProject
                  ? 'bg-blue-50 hover:bg-blue-100 border border-blue-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] dark:border-white/[0.06]'
                  : 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] dark:border-white/[0.06]'"
                @click="navigateToItem(parentDetail.id)"
              >
                <!-- Icon -->
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  :class="isParentProject ? 'bg-blue-100 dark:bg-white/[0.06]' : 'bg-emerald-100 dark:bg-white/[0.06]'"
                >
                  <Icon
                    :name="isParentProject ? 'heroicons:folder' : 'heroicons:clipboard-document-list'"
                    class="w-4 h-4"
                    :class="isParentProject ? 'text-blue-500 dark:text-zinc-400' : 'text-emerald-500 dark:text-zinc-400'"
                  />
                </div>

                <!-- Content -->
                <div class="flex-1 min-w-0">
                  <span
                    class="text-sm font-medium truncate block"
                    :class="isParentProject ? 'text-blue-700 dark:text-zinc-200' : 'text-emerald-700 dark:text-zinc-200'"
                  >
                    {{ parentDetail.title }}
                  </span>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span
                      class="text-[10px]"
                      :class="isParentProject ? 'text-blue-500 dark:text-zinc-500' : 'text-emerald-500 dark:text-zinc-500'"
                    >
                      {{ parentDetail.progress ?? 0 }}% complete
                    </span>
                    <span
                      v-if="parentDetail.childrenCount"
                      class="text-[10px]"
                      :class="isParentProject ? 'text-blue-400 dark:text-zinc-500' : 'text-emerald-400 dark:text-zinc-500'"
                    >
                      · {{ parentDetail.childrenCount }} items
                    </span>
                  </div>
                </div>

                <!-- Arrow -->
                <Icon
                  name="heroicons:arrow-up-right"
                  class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  :class="isParentProject ? 'text-blue-400 dark:text-zinc-500' : 'text-emerald-400 dark:text-zinc-500'"
                />
              </div>
            </div>
            
            <!-- Project-level indicator -->
            <div v-if="itemDetail && !itemDetail.parentId" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-white/[0.03] border border-blue-100 dark:border-white/[0.06]">
              <Icon name="heroicons:folder" class="w-4 h-4 text-blue-500 dark:text-zinc-400" />
              <span class="text-xs font-medium text-blue-700 dark:text-zinc-300">Top-level project</span>
              <span class="text-xs text-blue-500 dark:text-zinc-500">{{ itemDetail.childrenCount || 0 }} items inside</span>
            </div>

            <!-- Tab Bar -->
            <div class="flex items-center gap-1 border-b border-slate-200 dark:border-white/[0.06]">
              <button
                @click="activeTab = 'subtasks'"
                class="px-3 py-2 text-xs transition-colors relative"
                :class="activeTab === 'subtasks'
                  ? 'text-slate-900 dark:text-zinc-100 font-medium'
                  : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'"
              >
                Subtasks
                <span v-if="itemDetail?.children?.length || itemDetail?.childrenCount" class="ml-1 text-slate-400 dark:text-zinc-500 font-normal">({{ itemDetail.children?.length || itemDetail.childrenCount }})</span>
                <div v-if="activeTab === 'subtasks'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-zinc-100" />
              </button>
              <button
                @click="activeTab = 'comments'"
                class="px-3 py-2 text-xs transition-colors relative"
                :class="activeTab === 'comments'
                  ? 'text-slate-900 dark:text-zinc-100 font-medium'
                  : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'"
              >
                Comments
                <span v-if="itemDetail?.comments?.length" class="ml-1 text-slate-400 dark:text-zinc-500 font-normal">({{ itemDetail.comments.length }})</span>
                <div v-if="activeTab === 'comments'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 dark:bg-zinc-100" />
              </button>
            </div>

            <!-- Tab Content: Subtasks -->
            <div v-if="activeTab === 'subtasks'">
              <div v-if="itemDetail?.children?.length > 0 || itemDetail?.childrenCount > 0">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3 text-xs text-slate-500">
                    <span v-if="itemDetail.children?.length">{{ itemDetail.children.filter((c: any) => c.status === 'done').length }} of {{ itemDetail.children.length }} complete</span>
                  </div>
                  <button v-if="canEditItem" @click="startAddSubtask" class="text-xs text-emerald-500 hover:text-emerald-600 font-medium transition-colors">
                    + Add subtask
                  </button>
                </div>

                <!-- Subtasks progress overview -->
                <div v-if="itemDetail.children?.length" class="mb-3">
                  <div class="h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
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
                    class="group flex items-center gap-3 p-3 bg-slate-50 dark:bg-dm-card hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer"
                    @click="navigateToItem(subtask.id)"
                  >
                    <!-- Status checkbox -->
                    <div
                      :class="[
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                        subtask.status === 'done'
                          ? 'bg-emerald-500 border-emerald-500'
                          : subtask.status === 'blocked'
                            ? 'bg-rose-100 dark:bg-rose-500/10 border-rose-300 dark:border-rose-700'
                            : subtask.status === 'in_progress'
                              ? 'bg-blue-100 dark:bg-blue-500/10 border-blue-400 dark:border-blue-600'
                              : 'bg-white dark:bg-dm-card border-slate-300 dark:border-white/[0.1]'
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
                            subtask.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-zinc-300'
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
                        <div v-if="subtask.status === 'in_progress' && subtask.progress > 0" class="flex items-center gap-1.5">
                          <div class="w-16 h-1 bg-slate-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
                            <div
                              class="h-full bg-blue-400 rounded-full"
                              :style="{ width: `${subtask.progress}%` }"
                            />
                          </div>
                          <span class="text-[10px] text-slate-400">{{ subtask.progress }}%</span>
                        </div>
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
                      class="w-4 h-4 text-slate-300 dark:text-zinc-600 group-hover:text-slate-500 dark:group-hover:text-zinc-400 flex-shrink-0 transition-colors"
                    />
                  </div>
                </div>

                <!-- Inline add subtask -->
                <div v-if="showAddSubtask" class="mt-2 flex items-center gap-2">
                  <div class="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 dark:border-white/[0.1] flex-shrink-0" />
                  <input
                    ref="addSubtaskInput"
                    v-model="newSubtaskTitle"
                    type="text"
                    maxlength="255"
                    placeholder="Subtask title..."
                    class="flex-1 text-sm px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg bg-white dark:bg-white/[0.04] text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700 transition-all"
                    :disabled="addingSubtask"
                    @keyup.enter="submitSubtask"
                    @keyup.escape="cancelAddSubtask"
                  />
                </div>

                <!-- View all button -->
                <button
                  v-if="itemDetail.children?.length > 5"
                  class="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 font-medium text-center bg-slate-50 dark:bg-dm-card hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
                  @click="$emit('viewFull', item)"
                >
                  View all {{ itemDetail.childrenCount }} subtasks
                </button>
              </div>
              <div v-else class="text-center py-8 text-slate-400">
                <Icon name="heroicons:square-3-stack-3d" class="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p class="text-xs mb-3">No subtasks yet.</p>
                <div v-if="showAddSubtask" class="flex items-center gap-2 max-w-sm mx-auto">
                  <input
                    ref="addSubtaskInput"
                    v-model="newSubtaskTitle"
                    type="text"
                    maxlength="255"
                    placeholder="Subtask title..."
                    class="flex-1 text-sm px-3 py-2 border border-slate-200 dark:border-white/[0.06] rounded-lg bg-white dark:bg-white/[0.04] text-slate-900 dark:text-zinc-200 placeholder-slate-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-zinc-700 transition-all"
                    :disabled="addingSubtask"
                    @keyup.enter="submitSubtask"
                    @keyup.escape="cancelAddSubtask"
                  />
                </div>
                <button v-else-if="canEditItem" @click="startAddSubtask" class="text-xs text-emerald-500 hover:text-emerald-600 font-medium transition-colors">
                  + Add subtask
                </button>
              </div>
            </div>

            <!-- Tab Content: Comments -->
            <div v-else-if="activeTab === 'comments'">
              <!-- New comment input -->
              <div class="flex gap-3 mb-4">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center flex-shrink-0">
                  <span class="text-xs text-white font-medium">Y</span>
                </div>
                <div class="flex-1">
                  <textarea
                    v-model="newComment"
                    rows="2"
                    class="w-full text-sm text-slate-700 bg-slate-50 dark:bg-dm-card rounded-lg px-3 py-2 border border-slate-200 dark:border-white/[0.06] dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/30 resize-none placeholder-slate-400 dark:placeholder-zinc-500"
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
                    <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                      <span class="text-xs text-slate-600 dark:text-zinc-400 font-medium">
                        {{ comment.user?.name?.[0] ?? 'U' }}
                      </span>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-sm font-medium text-slate-800 dark:text-zinc-200">{{ comment.user?.name ?? 'User' }}</span>
                        <span class="text-xs text-slate-400">{{ formatRelativeTime(comment.createdAt) }}</span>
                      </div>
                      <MarkdownRenderer :content="comment.content" class="text-sm text-slate-600 dark:text-zinc-400" />

                      <!-- Nested replies -->
                      <div v-if="comment.replies?.length" class="mt-3 ml-2 pl-3 border-l-2 border-slate-100 dark:border-white/[0.06] space-y-3">
                        <div
                          v-for="reply in comment.replies"
                          :key="reply.id"
                          class="flex gap-3"
                        >
                          <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                            <span class="text-xs text-slate-600 dark:text-zinc-400 font-medium">
                              {{ reply.user?.name?.[0] ?? 'U' }}
                            </span>
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 mb-1">
                              <span class="text-sm font-medium text-slate-700 dark:text-zinc-300">{{ reply.user?.name ?? 'User' }}</span>
                              <span class="text-xs text-slate-400">{{ formatRelativeTime(reply.createdAt) }}</span>
                            </div>
                            <MarkdownRenderer :content="reply.content" class="text-sm text-slate-600 dark:text-zinc-400" />
                          </div>
                        </div>
                      </div>

                      <!-- Reply button -->
                      <button
                        @click="replyingTo = replyingTo === comment.id ? null : comment.id"
                        class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Reply
                      </button>

                      <!-- Reply input -->
                      <div v-if="replyingTo === comment.id" class="mt-2 ml-2 pl-3 border-l-2 border-slate-200 dark:border-white/[0.06]">
                        <textarea
                          v-model="replyText"
                          rows="2"
                          class="w-full text-sm text-slate-700 bg-slate-50 dark:bg-dm-card rounded-lg px-3 py-2 border border-slate-200 dark:border-white/[0.06] dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-500/20 focus:border-blue-300 dark:focus:border-blue-500/30 resize-none placeholder-slate-400 dark:placeholder-zinc-500"
                          placeholder="Write a reply..."
                          @keydown.meta.enter="submitReply(comment.id)"
                          @keydown.ctrl.enter="submitReply(comment.id)"
                        />
                        <div class="flex justify-end gap-2 mt-2">
                          <button
                            @click="replyingTo = null; replyText = ''"
                            class="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300"
                          >
                            Cancel
                          </button>
                          <button
                            @click="submitReply(comment.id)"
                            :disabled="!replyText.trim()"
                            class="px-2 py-1 text-xs font-medium text-white bg-slate-700 dark:bg-zinc-600 rounded hover:bg-slate-800 dark:hover:bg-zinc-500 transition-colors disabled:opacity-50"
                          >
                            Reply
                          </button>
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


            <!-- Delete Item -->
            <div v-if="canDeleteItem" class="pt-6 mt-6 border-t border-slate-100 dark:border-white/[0.06]">
              <div v-if="!showDeleteConfirm" class="flex items-center justify-between gap-3">
                <div class="text-xs text-slate-400">
                  Deleting removes this item permanently.
                </div>
                <button
                  @click="showDeleteConfirm = true; deleteError = null"
                  class="flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                >
                  <Icon name="heroicons:trash" class="w-4 h-4" />
                  Delete
                </button>
              </div>

              <div v-else class="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/20 p-4">
                <div class="flex items-start gap-3">
                  <div class="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                    <Icon name="heroicons:trash" class="w-4 h-4" />
                  </div>
                  <div class="flex-1">
                    <div class="text-sm font-medium text-rose-700 dark:text-rose-400">Delete this item?</div>
                    <p class="text-xs text-rose-600 dark:text-rose-400 mt-1">
                      This action cannot be undone.
                    </p>
                    <p v-if="itemDetail?.childrenCount > 0" class="text-xs text-rose-600 dark:text-rose-400 mt-2">
                      This will also delete all {{ itemDetail.childrenCount }} child items and their data.
                    </p>
                    <p v-if="deleteError" class="text-xs text-rose-700 dark:text-rose-400 mt-2">
                      {{ deleteError }}
                    </p>
                    <div class="mt-3 flex items-center gap-2">
                      <button
                        @click="showDeleteConfirm = false; deleteError = null"
                        class="px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-100/70 dark:hover:bg-rose-900/30 rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        @click="deleteItem"
                        :disabled="isDeleting"
                        class="px-3 py-1.5 text-xs text-white bg-rose-600 rounded-md hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {{ isDeleting ? 'Deleting...' : 'Confirm delete' }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>

  <ItemsCompleteWithChildrenModal
    :open="showCompleteWithChildren"
    :title="itemDetail?.title || props.item?.title"
    :max-depth="5"
    :loading="completeWithChildrenLoading"
    :error="completeWithChildrenError"
    @cancel="showCompleteWithChildren = false"
    @confirm="handleCompleteWithChildren"
  />
</template>

<style scoped>
/* Backdrop fade */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Panel slide-in from right */
.modal-enter-active .panel,
.modal-leave-active .panel {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.modal-enter-from .panel,
.modal-leave-to .panel {
  transform: translateX(100%);
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
