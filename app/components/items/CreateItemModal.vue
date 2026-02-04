<script setup lang="ts">
import { CATEGORY_COLORS, PRIORITY_OPTIONS } from '~/types'

const props = defineProps<{
  open: boolean
  parentTitle?: string
  isProject?: boolean
  workspaceId?: string | null
}>()

const emit = defineEmits<{
  close: []
  create: [item: { title: string; description?: string; category?: string; dueDate?: string; ownerId?: string | null; assigneeIds?: string[]; priority?: string }]
}>()

const { user } = useAuth()
const currentUserId = computed(() => user.value?.id ?? null)

const title = ref('')
const description = ref('')
const category = ref('')
const dueDate = ref('')
const priority = ref('MEDIUM')
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
  })
  
  // Reset form
  title.value = ''
  description.value = ''
  category.value = ''
  dueDate.value = ''
  assigneeIds.value = []
  ownerId.value = currentUserId.value ?? null
  priority.value = 'MEDIUM'
}

const handleClose = () => {
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
          class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm"
          @click="handleClose"
        />
        
        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-visible">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100">
            <h2 class="text-base font-medium text-slate-900">
              {{ isProject ? 'New Project' : 'New Item' }}
            </h2>
            <p v-if="parentTitle && !isProject" class="text-xs text-slate-400 mt-0.5">
              Adding to {{ parentTitle }}
            </p>
            <p v-else-if="isProject" class="text-xs text-slate-400 mt-0.5">
              Create a new project in your workspace
            </p>
          </div>
          
          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
            <!-- Title -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1.5">
                {{ isProject ? 'Project Name' : 'Title' }}
              </label>
              <input
                v-model="title"
                type="text"
                :placeholder="isProject ? 'Enter project name...' : 'What needs to be done?'"
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                autofocus
              />
            </div>
            
            <!-- Description -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1.5">
                Description
                <span class="text-slate-300 font-normal">(optional)</span>
              </label>
              <textarea
                v-model="description"
                rows="3"
                placeholder="Add more details..."
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all resize-none"
              />
            </div>

            <!-- Owner & Assignees Row -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Owner -->
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-2">Owner</label>
                <div class="relative" ref="ownerDropdownRef">
                  <button
                    type="button"
                    @click.stop="showOwnerDropdown = !showOwnerDropdown"
                    class="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:border-slate-300 transition-colors"
                  >
                    <template v-if="ownerUser">
                      <div class="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                        <span class="text-[10px] text-white font-medium">{{ ownerUser.name?.[0] ?? 'U' }}</span>
                      </div>
                      <span class="flex-1 text-left text-slate-700">{{ ownerUser.name }}</span>
                    </template>
                    <template v-else>
                      <div class="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                        <Icon name="heroicons:user" class="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <span class="flex-1 text-left text-slate-400">No owner</span>
                    </template>
                    <Icon name="heroicons:chevron-down" class="w-4 h-4 text-slate-400" />
                  </button>

                  <Transition name="dropdown">
                    <div
                      v-if="showOwnerDropdown"
                      class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10 max-h-48 overflow-y-auto"
                    >
                      <button
                        v-if="ownerUser"
                        type="button"
                        @click="updateOwner(null)"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                      >
                        <Icon name="heroicons:x-mark" class="w-5 h-5 text-slate-400" />
                        <span>Remove owner</span>
                      </button>
                      <div v-if="ownerUser" class="border-t border-slate-100 my-1" />

                      <button
                        v-for="userOption in availableUsers"
                        :key="userOption.id"
                        type="button"
                        @click="updateOwner(userOption.id)"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        :class="{ 'bg-amber-50': userOption.id === ownerId }"
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
                <label class="block text-xs font-medium text-slate-500 mb-2">Assignees</label>
                <div class="flex flex-wrap gap-2">
                  <div class="max-h-24 overflow-y-auto pr-1 flex flex-wrap gap-2">
                    <template v-if="assignedUsers.length">
                      <div
                        v-for="assignee in assignedUsers"
                        :key="assignee.id"
                        class="group flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-full text-xs"
                      >
                        <div class="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                          <span class="text-[8px] text-white font-medium">{{ assignee.name?.[0] ?? 'U' }}</span>
                        </div>
                        <span>{{ assignee.name }}</span>
                        <button
                          type="button"
                          @click="removeAssignee(assignee.id)"
                          class="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded transition-all"
                        >
                          <Icon name="heroicons:x-mark" class="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </template>
                  </div>

                  <div class="relative" ref="assigneeDropdownRef">
                    <button
                      type="button"
                      @click.stop="showAssigneeDropdown = !showAssigneeDropdown"
                      class="flex items-center gap-1 px-2 py-1 border border-dashed border-slate-300 rounded-full text-xs text-slate-400 hover:border-slate-400 hover:text-slate-500 transition-colors"
                    >
                      <Icon name="heroicons:plus" class="w-3 h-3" />
                      Add
                    </button>

                    <Transition name="dropdown">
                      <div
                        v-if="showAssigneeDropdown"
                        class="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10"
                      >
                        <div v-if="unassignedUsers.length === 0" class="px-3 py-2 text-xs text-slate-400">
                          No more users to add
                        </div>
                        <button
                          v-for="userOption in unassignedUsers"
                          :key="userOption.id"
                          type="button"
                          @click="assignUser(userOption.id)"
                          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
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
              </div>
            </div>
            
            <!-- Category & Priority row -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Category -->
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-2">Category</label>
                <div class="relative" ref="categoryDropdownRef">
                  <button
                    type="button"
                    @click.stop="showCategoryDropdown = !showCategoryDropdown"
                    class="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:border-slate-300 transition-colors"
                  >
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="category ? (categoryDotColors[category] || 'bg-slate-400') : 'bg-slate-300'"
                    />
                    <span class="flex-1 text-left text-slate-700">{{ category || 'No category' }}</span>
                    <Icon name="heroicons:chevron-down" class="w-4 h-4 text-slate-400" />
                  </button>

                  <Transition name="dropdown">
                    <div
                      v-if="showCategoryDropdown"
                      class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10 max-h-48 overflow-y-auto"
                    >
                      <button
                        type="button"
                        @click="category = ''; showCategoryDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 transition-colors"
                        :class="!category ? 'bg-slate-100 text-slate-900 font-medium' : ''"
                      >
                        <div class="w-2 h-2 rounded-full bg-slate-300" />
                        <span>No category</span>
                      </button>
                      <div class="border-t border-slate-100 my-1" />
                      <button
                        v-for="cat in categories"
                        :key="cat"
                        type="button"
                        @click="category = cat; showCategoryDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        :class="category === cat ? 'bg-slate-100 text-slate-900 font-medium' : ''"
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
                <label class="block text-xs font-medium text-slate-500 mb-2">Priority</label>
                <div class="relative" ref="priorityDropdownRef">
                  <button
                    type="button"
                    @click.stop="showPriorityDropdown = !showPriorityDropdown"
                    class="w-full flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:border-slate-300 transition-colors"
                  >
                    <div
                      class="w-2 h-2 rounded-full"
                      :class="priorityDotColors[priority] || 'bg-slate-300'"
                    />
                    <span class="flex-1 text-left text-slate-700">{{ priorityLabel }}</span>
                    <Icon name="heroicons:chevron-down" class="w-4 h-4 text-slate-400" />
                  </button>

                  <Transition name="dropdown">
                    <div
                      v-if="showPriorityDropdown"
                      class="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10 max-h-48 overflow-y-auto"
                    >
                      <button
                        v-for="opt in priorityOptions"
                        :key="opt.value"
                        type="button"
                        @click="priority = opt.value; showPriorityDropdown = false"
                        class="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        :class="priority === opt.value ? 'bg-slate-100 text-slate-900 font-medium' : ''"
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
              <label class="block text-xs font-medium text-slate-500 mb-1.5">
                Due Date
              </label>
              <input
                v-model="dueDate"
                type="date"
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
              />
            </div>
            
            <!-- Actions -->
            <div class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                @click="handleClose"
                class="px-4 py-2 text-sm font-normal text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!title.trim()"
                class="px-4 py-2 text-sm font-normal text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {{ isProject ? 'Create Project' : 'Create Item' }}
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
