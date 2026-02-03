<script setup lang="ts">
interface Space {
  id: string
  name: string
  slug: string
  description?: string | null
  maxIRsPer24h: number
  allowTaskSubmission: boolean
  stakeholderCount: number
  createdAt: string
  updatedAt: string
}

const props = defineProps<{
  open: boolean
  projectId: string
  space?: Space | null
}>()

const emit = defineEmits<{
  close: []
  saved: [space: Space]
  deleted: [spaceId: string]
}>()

const isEditing = computed(() => !!props.space)

const name = ref('')
const description = ref('')
const maxIRsPer24h = ref(10)
const allowTaskSubmission = ref(false)
const saving = ref(false)
const deleting = ref(false)
const error = ref<string | null>(null)
const showDeleteConfirm = ref(false)

// Reset form when modal opens or space changes
watch(() => [props.open, props.space], () => {
  if (props.open) {
    if (props.space) {
      name.value = props.space.name
      description.value = props.space.description || ''
      maxIRsPer24h.value = props.space.maxIRsPer24h
      allowTaskSubmission.value = props.space.allowTaskSubmission
    } else {
      name.value = ''
      description.value = ''
      maxIRsPer24h.value = 10
      allowTaskSubmission.value = false
    }
    error.value = null
    showDeleteConfirm.value = false
  }
}, { immediate: true })

const handleSubmit = async () => {
  if (!name.value.trim()) {
    error.value = 'Name is required'
    return
  }

  saving.value = true
  error.value = null

  try {
    const body = {
      name: name.value.trim(),
      description: description.value.trim() || null,
      maxIRsPer24h: maxIRsPer24h.value,
      allowTaskSubmission: allowTaskSubmission.value
    }

    let response: { space: Space }

    if (isEditing.value && props.space) {
      response = await $fetch(`/api/projects/${props.projectId}/spaces/${props.space.id}`, {
        method: 'PATCH',
        body
      })
    } else {
      response = await $fetch(`/api/projects/${props.projectId}/spaces`, {
        method: 'POST',
        body
      })
    }

    emit('saved', response.space)
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Failed to save space'
  } finally {
    saving.value = false
  }
}

const handleDelete = async () => {
  if (!props.space) return
  
  deleting.value = true
  error.value = null

  try {
    await $fetch(`/api/projects/${props.projectId}/spaces/${props.space.id}`, {
      method: 'DELETE'
    })
    emit('deleted', props.space.id)
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Failed to delete space'
  } finally {
    deleting.value = false
  }
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
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100">
            <h2 class="text-base font-medium text-slate-900">
              {{ isEditing ? 'Space Settings' : 'Create External Space' }}
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              {{ isEditing ? 'Configure how stakeholders interact with this space' : 'Create a portal for external stakeholders' }}
            </p>
          </div>
          
          <!-- Form -->
          <form @submit.prevent="handleSubmit" class="p-6 space-y-4">
            <!-- Error -->
            <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {{ error }}
            </div>

            <!-- Name -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1.5">
                Space Name
              </label>
              <input
                v-model="name"
                type="text"
                placeholder="e.g., Protencon, Investors, Power Users"
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
                rows="2"
                placeholder="Brief description shown to stakeholders..."
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all resize-none"
              />
            </div>
            
            <!-- Settings row -->
            <div class="flex gap-4">
              <!-- Max IRs per 24h -->
              <div class="flex-1">
                <label class="block text-xs font-medium text-slate-500 mb-1.5">
                  Max Requests / Day
                </label>
                <input
                  v-model.number="maxIRsPer24h"
                  type="number"
                  min="0"
                  max="100"
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                />
                <p class="text-xs text-slate-400 mt-1">Rate limit per stakeholder</p>
              </div>
              
              <!-- Allow Task Submission -->
              <div class="flex-1">
                <label class="block text-xs font-medium text-slate-500 mb-1.5">
                  Task Submission
                </label>
                <button
                  type="button"
                  @click="allowTaskSubmission = !allowTaskSubmission"
                  :class="[
                    'flex items-center gap-2 w-full px-3 py-2 text-sm border rounded-lg transition-all',
                    allowTaskSubmission 
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                      : 'bg-white border-slate-200 text-slate-600'
                  ]"
                >
                  <Icon 
                    :name="allowTaskSubmission ? 'heroicons:check-circle' : 'heroicons:x-circle'" 
                    class="w-4 h-4" 
                  />
                  <span>{{ allowTaskSubmission ? 'Enabled' : 'Disabled' }}</span>
                </button>
                <p class="text-xs text-slate-400 mt-1">Can stakeholders submit tasks?</p>
              </div>
            </div>
            
            <!-- Delete zone (only when editing) -->
            <div v-if="isEditing && space" class="pt-4 border-t border-slate-100">
              <div v-if="!showDeleteConfirm" class="flex items-center justify-between">
                <div>
                  <p class="text-xs font-medium text-slate-600">Delete Space</p>
                  <p class="text-xs text-slate-400">Stakeholders will lose access immediately</p>
                </div>
                <button
                  type="button"
                  @click="showDeleteConfirm = true"
                  class="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Delete
                </button>
              </div>
              <div v-else class="flex items-center justify-between bg-red-50 -mx-6 -mb-6 p-4 mt-4">
                <p class="text-sm text-red-700">
                  Delete "{{ space.name }}"? This cannot be undone.
                </p>
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="showDeleteConfirm = false"
                    class="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                    :disabled="deleting"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    @click="handleDelete"
                    :disabled="deleting"
                    class="px-3 py-1.5 text-xs text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {{ deleting ? 'Deleting...' : 'Delete' }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div v-if="!showDeleteConfirm" class="flex justify-end gap-2 pt-2">
              <button
                type="button"
                @click="handleClose"
                class="px-4 py-2 text-sm font-normal text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                :disabled="!name.trim() || saving"
                class="px-4 py-2 text-sm font-normal text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {{ saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Space') }}
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
</style>
