<script setup lang="ts">
import { CATEGORY_COLORS, PRIORITY_OPTIONS } from '~/types'

const props = defineProps<{
  open: boolean
  parentTitle?: string
  isProject?: boolean
  workspaceId?: string | null
  parentId?: string | null
}>()

const emit = defineEmits<{
  close: []
  create: [item: { title: string; description?: string; category?: string; dueDate?: string; ownerId?: string | null; assigneeIds?: string[]; priority?: string; status?: string; agentMode?: 'PLAN' | 'EXECUTE' | 'COMPLETED' | null }]
  aiCreated: [item: any]
}>()

const { user } = useAuth()
const currentUserId = computed(() => user.value?.id ?? null)
const mode = ref<'ai' | 'manual'>('ai')
const aiInput = ref('')
const aiCreating = ref(false)
const aiError = ref<string | null>(null)
const aiSuccess = ref(false)
const aiCreatedCount = ref(1)
const aiCreatedSubtasks = ref(0)
const aiSuccessTimer = ref<ReturnType<typeof setTimeout> | null>(null)

const title = ref('')
const description = ref('')
const category = ref('')
const dueDate = ref('')
const priority = ref('MEDIUM')
const status = ref<'TODO' | 'IN_PROGRESS'>('IN_PROGRESS')
const ownerId = ref<string | null>(null)
const assigneeIds = ref<string[]>([])

const categories = Object.keys(CATEGORY_COLORS)
const priorityOptions = PRIORITY_OPTIONS

const availableUsers = ref<any[]>([])

const loadUsers = async () => {
  if (!props.workspaceId) return
  try {
    availableUsers.value = await $fetch('/api/users', {
      query: { workspaceId: props.workspaceId }
    })
  } catch (e) {
    console.error('Failed to load users:', e)
    availableUsers.value = []
  }
}

watch(() => props.workspaceId, () => {
  if (props.open) loadUsers()
})

watch(() => props.open, (open) => {
  if (open) {
    loadUsers()
    if (!ownerId.value && currentUserId.value) {
      ownerId.value = currentUserId.value
    }
    mode.value = props.isProject ? 'manual' : 'ai'
    resetAiState()
    if (!props.isProject) {
      resetManualForm()
    }
  } else {
    clearAiTimer()
  }
})

watch(currentUserId, (id) => {
  if (props.open && !ownerId.value && id) {
    ownerId.value = id
  }
})

const ownerUser = computed(() => availableUsers.value.find((u: any) => u.id === ownerId.value) || null)

const assignedUsers = computed(() => {
  const assigned = new Set(assigneeIds.value)
  return availableUsers.value.filter((u: any) => assigned.has(u.id))
})

const hasAssignedAgent = computed(() => assignedUsers.value.some((u: any) => !!u.isAgent))
const agentAssignmentMode = ref<'PLAN' | 'EXECUTE'>('PLAN')

watch(hasAssignedAgent, (hasAgent) => {
  if (!hasAgent) {
    agentAssignmentMode.value = 'PLAN'
  }
})

const unassignedUsers = computed(() => {
  const assigned = new Set(assigneeIds.value)
  return availableUsers.value.filter((u: any) => !assigned.has(u.id))
})

const showOwnerDropdown = ref(false)
const showAssigneeDropdown = ref(false)
const showCategoryDropdown = ref(false)
const showPriorityDropdown = ref(false)
const ownerDropdownRef = ref<HTMLElement | null>(null)
const assigneeDropdownRef = ref<HTMLElement | null>(null)
const categoryDropdownRef = ref<HTMLElement | null>(null)
const priorityDropdownRef = ref<HTMLElement | null>(null)

const clearAiTimer = () => {
  if (aiSuccessTimer.value) {
    clearTimeout(aiSuccessTimer.value)
    aiSuccessTimer.value = null
  }
}

const resetManualForm = () => {
  title.value = ''
  description.value = ''
  category.value = ''
  dueDate.value = ''
  assigneeIds.value = []
  ownerId.value = currentUserId.value ?? null
  priority.value = 'MEDIUM'
  status.value = 'IN_PROGRESS'
  agentAssignmentMode.value = 'PLAN'
}

const resetAiState = () => {
  clearAiTimer()
  aiInput.value = ''
  aiError.value = null
  aiSuccess.value = false
  aiCreating.value = false
  aiCreatedCount.value = 1
  aiCreatedSubtasks.value = 0
}

const handleSubmit = () => {
  if (!title.value.trim()) return
  
  emit('create', {
    title: title.value.trim(),
    description: description.value.trim() || undefined,
    category: category.value || undefined,
    dueDate: dueDate.value || undefined,
    ownerId: ownerId.value,
    assigneeIds: assigneeIds.value.length ? assigneeIds.value : undefined,
    priority: priority.value || undefined,
    status: status.value,
    agentMode: hasAssignedAgent.value ? agentAssignmentMode.value : null,
  })
  
  resetManualForm()
}

const handleAiSubmit = async () => {
  if (!aiInput.value.trim() || aiCreating.value || aiSuccess.value) return
  if (!props.workspaceId || !props.parentId) {
    aiError.value = 'Missing workspace or parent project context.'
    return
  }

  aiCreating.value = true
  aiError.value = null

  try {
    const response = await $fetch<{ item: any; createdTaskCount: number; subtaskCount: number }>('/api/items/ai-create', {
      method: 'POST',
      body: {
        workspaceId: props.workspaceId,
        parentId: props.parentId,
        input: aiInput.value.trim(),
      },
    })

    aiSuccess.value = true
    aiCreatedCount.value = response.createdTaskCount || 1
    aiCreatedSubtasks.value = response.subtaskCount || 0
    aiInput.value = ''

    clearAiTimer()
    aiSuccessTimer.value = setTimeout(() => {
      emit('aiCreated', response.item)
      emit('close')
      resetAiState()
    }, 2000)
  } catch (e: any) {
    aiError.value = e?.data?.message || e?.message || 'Failed to generate task.'
  } finally {
    aiCreating.value = false
  }
}

const handleClose = () => {
  if (aiCreating.value) return
  emit('close')
}

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

onMounted(() => {
  const handleClickOutside = (e: MouseEvent) => {
    if (ownerDropdownRef.value && !ownerDropdownRef.value.contains(e.target as Node)) {
      showOwnerDropdown.value = false
    }
    if (assigneeDropdownRef.value && !assigneeDropdownRef.value.contains(e.target as Node)) {
      showAssigneeDropdown.value = false
    }
    if (categoryDropdownRef.value && !categoryDropdownRef.value.contains(e.target as Node)) {
      showCategoryDropdown.value = false
    }
    if (priorityDropdownRef.value && !priorityDropdownRef.value.contains(e.target as Node)) {
      showPriorityDropdown.value = false
    }
  }
  document.addEventListener('click', handleClickOutside)
  onUnmounted(() => document.removeEventListener('click', handleClickOutside))
})

const updateOwner = (userId: string | null) => {
  ownerId.value = userId
  showOwnerDropdown.value = false
}

const assignUser = (userId: string) => {
  if (!assigneeIds.value.includes(userId)) {
    assigneeIds.value = [...assigneeIds.value, userId]
  }
  showAssigneeDropdown.value = false
}

const removeAssignee = (userId: string) => {
  assigneeIds.value = assigneeIds.value.filter(id => id !== userId)
}

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

const priorityDotColors: Record<string, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-rose-500',
}

const priorityLabel = computed(() => {
  return priorityOptions.find(opt => opt.value === priority.value)?.label ?? 'Medium'
})

onUnmounted(() => {
  clearAiTimer()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div 
        v-if="open" 
        class="fixed inset-0 z-50 flex items-center justify-center"
      >
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-slate-900/20 dark:bg-black/50 backdrop-blur-sm"
          @click="handleClose"
        />
        
        <!-- Modal -->
        <div class="relative bg-white dark:bg-dm-panel rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-visible">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
            <h2 class="text-base font-medium text-slate-900 dark:text-zinc-100">
              {{ isProject ? 'New Project' : 'New Item' }}
            </h2>
            <p v-if="parentTitle && !isProject" class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Adding to {{ parentTitle }}
            </p>
            <p v-else-if="isProject" class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
              Create a new project in your workspace
            </p>
          </div>

          <!-- Mode Toggle -->
          <div v-if="!isProject" class="px-6 pt-4">
            <div class="inline-flex p-1 rounded-lg bg-slate-100 border border-slate-200 dark:bg-white/[0.06] dark:border-white/[0.06]">
              <button
                type="button"
                @click="mode = 'ai'"
                :class="[
                  'px-3 py-1.5 text-xs rounded-md transition-all',
                  mode === 'ai' ? 'bg-white text-slate-900 shadow-sm dark:bg-white/[0.12] dark:text-zinc-100' : 'text-slate-500 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                ]"
              >
                ClawLab AI
              </button>
              <button
                type="button"
                @click="mode = 'manual'"
                :class="[
                  'px-3 py-1.5 text-xs rounded-md transition-all',
                  mode === 'manual' ? 'bg-white text-slate-900 shadow-sm dark:bg-white/[0.12] dark:text-zinc-100' : 'text-slate-500 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                ]"
              >
                Manual
              </button>
            </div>
          </div>

          <!-- Manual Form -->
          <form v-if="isProject || mode === 'manual'" @submit.prevent="handleSubmit" class="p-6 space-y-4">
            <!-- Title -->
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">
                {{ isProject ? 'Project Name' : 'Title' }}
              </label>
              <input
                v-model="title"
                type="text"
                :placeholder="isProject ? 'Enter project name...' : 'What needs to be done?'"
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all dark:bg-white/[0.06] dark:border-white/[0.06] dark:text-zinc-100 dark:placeholder-zinc-500"
                autofocus
              />
            </div>
            
            <!-- Description -->
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">
                Description
                <span class="text-slate-300 dark:text-zinc-600 font-normal">(optional)</span>
              </label>
              <textarea
                v-model="description"
                rows="3"
                placeholder="Add more details..."
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all resize-none dark:bg-white/[0.06] dark:border-white/[0.06] dark:text-zinc-100 dark:placeholder-zinc-500"
              />
            </div>

            <!-- Status selector (projects only) -->
            <div v-if="isProject">
              <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-2">Starting Status</label>
              <div class="inline-flex p-0.5 rounded-lg bg-slate-100 border border-slate-200 dark:bg-white/[0.06] dark:border-white/[0.06]">
                <button
                  type="button"
                  @click="status = 'IN_PROGRESS'"
                  :class="[
                    'px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1.5',
                    status === 'IN_PROGRESS' ? 'bg-white text-slate-900 shadow-sm dark:bg-white/[0.12] dark:text-zinc-100' : 'text-slate-500 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                  ]"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  In Progress
                </button>
                <button
                  type="button"
                  @click="status = 'TODO'"
                  :class="[
                    'px-3 py-1.5 text-xs rounded-md transition-all flex items-center gap-1.5',
                    status === 'TODO' ? 'bg-white text-slate-900 shadow-sm dark:bg-white/[0.12] dark:text-zinc-100' : 'text-slate-500 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300'
                  ]"
                >
                  <div class="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  Backlog
                </button>
              </div>
            </div>

            <!-- Owner & Assignees Row -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Owner -->
              <div>
                <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-2">Owner</label>
                <div class="relative" ref="ownerDropdownRef">
                  <button
                    type="button"
                    @click.stop="showOwnerDropdown = !showOwnerDropdown"
                    class="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:border-slate-300 transition-colors dark:border-white/[0.06] dark:hover:border-white/[0.09]"
                  >
                    <template v-if="ownerUser">
                      <div class="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <span class="text-[10px] text-white font-medium">{{ ownerUser.name?.[0] ?? 'U' }}</span>
                      </div>
                      <span class="flex-1 text-left text-slate-700 dark:text-zinc-200">{{ ownerUser.name }}</span>
                    </template>
                    <template v-else>
                      <div class="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/[0.08] flex items-center justify-center">
                        <Icon name="heroicons:user" class="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                      </div>
                      <span class="flex-1 text-left text-slate-400 dark:text-zinc-500">No owner</span>
                    </template>
                    <Icon name="heroicons:chevron-down" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                  </button>

                  <Transition name="dropdown">
                    <div
                      v-if="showOwnerDropdown"
                      class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dm-card rounded-lg shadow-lg border border-slate-200 dark:border-white/[0.06] py-1 z-10 max-h-48 overflow-y-auto"
                    >
                      <button
                        v-if="ownerUser"
                        type="button"
                        @click="updateOwner(null)"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors dark:text-zinc-400 dark:hover:bg-white/[0.04]"
                      >
                        <Icon name="heroicons:x-mark" class="w-5 h-5 text-slate-400 dark:text-zinc-500" />
                        <span>Remove owner</span>
                      </button>
                      <div v-if="ownerUser" class="border-t border-slate-100 dark:border-white/[0.06] my-1" />

                      <button
                        v-for="userOption in availableUsers"
                        :key="userOption.id"
                        type="button"
                        @click="updateOwner(userOption.id)"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors dark:text-zinc-300 dark:hover:bg-white/[0.04]"
                        :class="{ 'bg-amber-50 dark:bg-amber-500/10': userOption.id === ownerId }"
                      >
                        <div class="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                          <span class="text-[10px] text-white font-medium">{{ userOption.name?.[0] ?? 'U' }}</span>
                        </div>
                        <span>{{ userOption.name }}</span>
                        <Icon v-if="userOption.id === ownerId" name="heroicons:check" class="w-4 h-4 text-amber-500 ml-auto" />
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>

              <!-- Assignees -->
              <div>
                <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-2">Assignees</label>
                <div class="flex flex-wrap gap-2">
                  <div class="max-h-24 overflow-y-auto pr-1 flex flex-wrap gap-2">
                    <template v-if="assignedUsers.length">
                      <div
                        v-for="assignee in assignedUsers"
                        :key="assignee.id"
                        class="group flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-white/[0.08] rounded-full text-xs"
                      >
                        <div class="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                          <span class="text-[8px] text-white font-medium">{{ assignee.name?.[0] ?? 'U' }}</span>
                        </div>
                        <span>{{ assignee.name }}</span>
                        <span
                          v-if="assignee.isAgent"
                          class="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-medium"
                        >
                          AI
                        </span>
                        <button
                          type="button"
                          @click="removeAssignee(assignee.id)"
                          class="opacity-0 group-hover:opacity-100 inline-flex h-5 w-5 items-center justify-center leading-none hover:bg-slate-200 dark:hover:bg-white/[0.12] rounded transition-all"
                        >
                          <Icon name="heroicons:x-mark" class="w-3.5 h-3.5 text-slate-400" />
                        </button>
                      </div>
                    </template>
                  </div>

                  <div class="relative" ref="assigneeDropdownRef">
                    <button
                      type="button"
                      @click.stop="showAssigneeDropdown = !showAssigneeDropdown"
                      class="flex items-center gap-1 px-2 py-1 border border-dashed border-slate-300 rounded-full text-xs text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors dark:border-zinc-600 dark:text-zinc-500 dark:hover:border-zinc-500 dark:hover:text-zinc-400"
                    >
                      <Icon name="heroicons:plus" class="w-3 h-3" />
                      Add
                    </button>

                    <Transition name="dropdown">
                      <div
                        v-if="showAssigneeDropdown"
                        class="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-dm-card rounded-lg shadow-lg border border-slate-200 dark:border-white/[0.06] py-1 z-10"
                      >
                        <div v-if="unassignedUsers.length === 0" class="px-3 py-2 text-xs text-slate-400 dark:text-zinc-500">
                          No more users to add
                        </div>
                        <button
                          v-for="userOption in unassignedUsers"
                          :key="userOption.id"
                          type="button"
                          @click="assignUser(userOption.id)"
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors dark:text-zinc-300 dark:hover:bg-white/[0.04]"
                        >
                          <div class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                            <span class="text-[10px] text-white font-medium">{{ userOption.name?.[0] ?? 'U' }}</span>
                          </div>
                          <span>{{ userOption.name }}</span>
                        </button>
                      </div>
                    </Transition>
                  </div>
                </div>
                <div
                  v-if="hasAssignedAgent"
                  class="mt-2 w-full flex items-center justify-between rounded-lg border border-blue-100 dark:border-blue-500/20 bg-blue-50/70 dark:bg-blue-500/10 px-2.5 py-1.5"
                >
                  <label class="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      :checked="agentAssignmentMode === 'EXECUTE'"
                      class="h-3.5 w-3.5 rounded border-slate-300 dark:border-zinc-600 text-blue-500 focus:ring-blue-200 dark:focus:ring-blue-500/30"
                      @change="agentAssignmentMode = ($event.target as HTMLInputElement).checked ? 'EXECUTE' : 'PLAN'"
                    />
                    Skip planning -> Execute directly
                  </label>
                  <span class="text-[10px] font-medium text-blue-700 dark:text-blue-300">
                    {{ agentAssignmentMode === 'EXECUTE' ? 'EXECUTE' : 'PLAN' }}
                  </span>
                </div>
              </div>
            </div>
            
            <!-- Category & Priority row -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Category -->
              <div>
                <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-2">Category</label>
                <div class="relative" ref="categoryDropdownRef">
                  <button
                    type="button"
                    @click.stop="showCategoryDropdown = !showCategoryDropdown"
                    class="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:border-slate-300 transition-colors dark:border-white/[0.06] dark:hover:border-white/[0.09]"
                  >
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="category ? (categoryDotColors[category] || 'bg-slate-400') : 'bg-slate-300'"
                    />
                    <span class="flex-1 text-left text-slate-700 dark:text-zinc-200">{{ category || 'No category' }}</span>
                    <Icon name="heroicons:chevron-down" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                  </button>

                  <Transition name="dropdown">
                    <div
                      v-if="showCategoryDropdown"
                      class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dm-card rounded-lg shadow-lg border border-slate-200 dark:border-white/[0.06] py-1 z-10 max-h-48 overflow-y-auto"
                    >
                      <button
                        type="button"
                        @click="category = ''; showCategoryDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors dark:text-zinc-400 dark:hover:bg-white/[0.04]"
                        :class="!category ? 'bg-slate-100 text-slate-900 font-medium dark:bg-white/[0.08] dark:text-zinc-100' : ''"
                      >
                        <div class="w-2 h-2 rounded-full bg-slate-300" />
                        <span>No category</span>
                      </button>
                      <div class="border-t border-slate-100 dark:border-white/[0.06] my-1" />
                      <button
                        v-for="cat in categories"
                        :key="cat"
                        type="button"
                        @click="category = cat; showCategoryDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors dark:text-zinc-300 dark:hover:bg-white/[0.04]"
                        :class="category === cat ? 'bg-slate-100 text-slate-900 font-medium dark:bg-white/[0.08] dark:text-zinc-100' : ''"
                      >
                        <div class="w-2 h-2 rounded-full" :class="categoryDotColors[cat] || 'bg-slate-400'" />
                        <span>{{ cat }}</span>
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>

              <!-- Priority -->
              <div>
                <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-2">Priority</label>
                <div class="relative" ref="priorityDropdownRef">
                  <button
                    type="button"
                    @click.stop="showPriorityDropdown = !showPriorityDropdown"
                    class="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:border-slate-300 transition-colors dark:border-white/[0.06] dark:hover:border-white/[0.09]"
                  >
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="priorityDotColors[priority] || 'bg-slate-300'"
                    />
                    <span class="flex-1 text-left text-slate-700 dark:text-zinc-200">{{ priorityLabel }}</span>
                    <Icon name="heroicons:chevron-down" class="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                  </button>

                  <Transition name="dropdown">
                    <div
                      v-if="showPriorityDropdown"
                      class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-dm-card rounded-lg shadow-lg border border-slate-200 dark:border-white/[0.06] py-1 z-10 max-h-48 overflow-y-auto"
                    >
                      <button
                        v-for="opt in priorityOptions"
                        :key="opt.value"
                        type="button"
                        @click="priority = opt.value; showPriorityDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors dark:text-zinc-300 dark:hover:bg-white/[0.04]"
                        :class="priority === opt.value ? 'bg-slate-100 text-slate-900 font-medium dark:bg-white/[0.08] dark:text-zinc-100' : ''"
                      >
                        <div class="w-2 h-2 rounded-full" :class="priorityDotColors[opt.value] || 'bg-slate-400'" />
                        <span>{{ opt.label }}</span>
                      </button>
                    </div>
                  </Transition>
                </div>
              </div>
            </div>

            <!-- Due Date -->
            <div>
              <label class="block text-xs font-medium text-slate-500 dark:text-zinc-400 mb-1.5">
                Due Date
              </label>
              <input
                v-model="dueDate"
                type="date"
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all dark:bg-white/[0.06] dark:border-white/[0.06] dark:text-zinc-100 dark:placeholder-zinc-500"
              />
            </div>
            
            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                @click="handleClose"
                class="px-4 py-2 text-sm font-normal text-slate-600 hover:text-slate-800 transition-colors dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!title.trim()"
                class="px-4 py-2 text-sm font-normal text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all dark:bg-white/[0.1] dark:text-zinc-200 dark:hover:bg-white/[0.15]"
              >
                {{ isProject ? 'Create Project' : 'Create Item' }}
              </button>
            </div>
          </form>

          <!-- AI Form -->
          <form v-else @submit.prevent="handleAiSubmit" class="p-6 space-y-4">
            <div
              :class="[
                'rounded-xl border bg-gradient-to-br p-4 transition-all duration-300',
                aiCreating
                  ? 'border-violet-300 from-violet-100 via-white to-sky-100 shadow-[0_0_0_2px_rgba(139,92,246,0.08)] dark:border-violet-500/30 dark:from-violet-500/10 dark:via-dm-card dark:to-sky-500/10'
                  : 'border-violet-200/70 from-violet-50 via-white to-blue-50 dark:border-violet-500/20 dark:from-violet-500/5 dark:via-dm-card dark:to-blue-500/5'
              ]"
            >
              <label class="block text-xs font-medium text-slate-600 dark:text-zinc-300 mb-2">
                Describe what should be created
              </label>
              <textarea
                v-model="aiInput"
                rows="7"
                placeholder="Paste an email, spec, bug report, or task description..."
                :disabled="aiCreating || aiSuccess"
                class="w-full px-3 py-2 text-sm border border-violet-200/80 rounded-lg bg-white/90 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300 transition-all resize-none disabled:opacity-70 dark:bg-white/[0.06] dark:border-violet-500/20 dark:text-zinc-100 dark:placeholder-zinc-500"
                autofocus
              />
              <p class="text-xs text-slate-500 dark:text-zinc-500 mt-2">
                ClawLab AI will generate one task, or a parent task with up to 5 subtasks if a hierarchy is clear.
              </p>

              <div
                v-if="aiCreating"
                class="mt-3 flex items-center gap-2 text-violet-700 dark:text-violet-400"
              >
                <Icon name="heroicons:arrow-path" class="w-4 h-4 animate-spin" />
                <span class="text-xs font-medium animate-pulse">ClawLab AI is shaping your task plan...</span>
              </div>
            </div>

            <div
              v-if="aiError"
              class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400"
            >
              {{ aiError }}
            </div>

            <div
              v-if="aiSuccess"
              class="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
            >
              Created {{ aiCreatedCount }} task{{ aiCreatedCount === 1 ? '' : 's' }}
              <span v-if="aiCreatedSubtasks > 0"> ({{ aiCreatedSubtasks }} subtasks)</span>.
              Opening item...
            </div>

            <div class="flex justify-end gap-2 pt-1">
              <button
                type="button"
                @click="handleClose"
                :disabled="aiCreating || aiSuccess"
                class="px-4 py-2 text-sm font-normal text-slate-600 hover:text-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!aiInput.trim() || aiCreating || aiSuccess"
                class="px-4 py-2 text-sm font-normal text-white bg-violet-600 rounded-lg hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <span v-if="aiCreating">Creating...</span>
                <span v-else-if="aiSuccess">Created</span>
                <span v-else>Create</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.15s ease;
}

.modal-enter-from > div:last-child,
.modal-leave-to > div:last-child {
  transform: scale(0.95);
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
