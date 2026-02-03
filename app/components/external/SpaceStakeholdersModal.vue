<script setup lang="ts">
interface Space {
  id: string
  name: string
  slug: string
  description?: string | null
  maxIRsPer24h: number
  allowTaskSubmission: boolean
  stakeholderCount: number
}

interface Stakeholder {
  id: string
  email: string
  name: string | null
  avatar: string | null
  position: string | null
  canSubmitTasks: boolean
  maxIRsPer24h: number
  invitedAt: string
  invitedBy: { id: string; name: string | null } | null
  stats: {
    informationRequests: number
    externalTasks: number
  }
}

const props = defineProps<{
  open: boolean
  projectId: string
  space: Space
}>()

const emit = defineEmits<{
  close: []
}>()

const stakeholders = ref<Stakeholder[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const removingId = ref<string | null>(null)
const inviteUrl = ref<string | null>(null)
const copiedInvite = ref(false)

const fetchStakeholders = async () => {
  loading.value = true
  error.value = null
  try {
    const response = await $fetch<{ stakeholders: Stakeholder[] }>(
      `/api/projects/${props.projectId}/spaces/${props.space.id}/stakeholders`
    )
    stakeholders.value = response.stakeholders
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Failed to load stakeholders'
  } finally {
    loading.value = false
  }
}

const generateInvite = async () => {
  try {
    const response = await $fetch<{ inviteUrl: string }>(
      `/api/projects/${props.projectId}/spaces/${props.space.id}/invite`,
      { method: 'POST' }
    )
    inviteUrl.value = response.inviteUrl
    await copyInvite()
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Failed to generate invite'
  }
}

const copyInvite = async () => {
  if (!inviteUrl.value) return
  try {
    await navigator.clipboard.writeText(inviteUrl.value)
    copiedInvite.value = true
    setTimeout(() => {
      copiedInvite.value = false
    }, 2000)
  } catch (e) {
    // Fallback for older browsers
    alert('Copy this link: ' + inviteUrl.value)
  }
}

const removeStakeholder = async (stakeholder: Stakeholder) => {
  if (!confirm(`Remove ${stakeholder.name || stakeholder.email} from this space?`)) return
  
  removingId.value = stakeholder.id
  try {
    await $fetch(
      `/api/projects/${props.projectId}/spaces/${props.space.id}/stakeholders/${stakeholder.id}`,
      { method: 'DELETE' }
    )
    stakeholders.value = stakeholders.value.filter(s => s.id !== stakeholder.id)
  } catch (e: any) {
    alert('Failed to remove stakeholder: ' + (e.data?.message || e.message))
  } finally {
    removingId.value = null
  }
}

const togglingTaskPermission = ref<string | null>(null)

const toggleTaskPermission = async (stakeholder: Stakeholder) => {
  togglingTaskPermission.value = stakeholder.id
  try {
    await $fetch(
      `/api/projects/${props.projectId}/spaces/${props.space.id}/stakeholders/${stakeholder.id}`,
      { 
        method: 'PATCH',
        body: { canSubmitTasks: !stakeholder.canSubmitTasks }
      }
    )
    // Update local state
    const idx = stakeholders.value.findIndex(s => s.id === stakeholder.id)
    if (idx !== -1) {
      stakeholders.value[idx].canSubmitTasks = !stakeholder.canSubmitTasks
    }
  } catch (e: any) {
    alert('Failed to update permissions: ' + (e.data?.message || e.message))
  } finally {
    togglingTaskPermission.value = null
  }
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Fetch when modal opens
watch(() => props.open, (open) => {
  if (open) {
    fetchStakeholders()
    inviteUrl.value = null
    copiedInvite.value = false
  }
}, { immediate: true })

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
  
  // Fetch if modal is already open when mounted
  if (props.open) {
    fetchStakeholders()
  }
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
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-xl mx-4 overflow-hidden max-h-[80vh] flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-base font-medium text-slate-900">
                  {{ space.name }} — Stakeholders
                </h2>
                <p class="text-xs text-slate-400 mt-0.5">
                  {{ stakeholders.length }} {{ stakeholders.length === 1 ? 'member' : 'members' }}
                </p>
              </div>
              <button
                @click="handleClose"
                class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Icon name="heroicons:x-mark" class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Invite Link Section -->
          <div class="px-6 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
            <div class="flex items-center gap-3">
              <div class="flex-1">
                <p class="text-xs font-medium text-slate-600 mb-1">Invite Link</p>
                <div v-if="inviteUrl" class="flex items-center gap-2">
                  <input
                    :value="inviteUrl"
                    readonly
                    class="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600"
                  />
                  <button
                    @click="copyInvite"
                    :class="[
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                      copiedInvite 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    ]"
                  >
                    {{ copiedInvite ? 'Copied!' : 'Copy' }}
                  </button>
                </div>
                <p v-else class="text-xs text-slate-400">
                  Generate a link to invite stakeholders to this space
                </p>
              </div>
              <button
                v-if="!inviteUrl"
                @click="generateInvite"
                class="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-lg hover:bg-violet-700 transition-colors"
              >
                <Icon name="heroicons:link" class="w-3.5 h-3.5" />
                Generate Link
              </button>
            </div>
          </div>
          
          <!-- Content -->
          <div class="flex-1 overflow-auto">
            <!-- Loading -->
            <div v-if="loading" class="flex items-center justify-center py-12">
              <div class="w-6 h-6 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
            </div>

            <!-- Error -->
            <div v-else-if="error" class="text-center py-12 px-6">
              <Icon name="heroicons:exclamation-circle" class="w-8 h-8 text-red-400 mx-auto mb-2" />
              <p class="text-sm text-slate-600">{{ error }}</p>
              <button @click="fetchStakeholders" class="text-xs text-blue-600 hover:underline mt-2">
                Try again
              </button>
            </div>

            <!-- Empty State -->
            <div v-else-if="stakeholders.length === 0" class="text-center py-12 px-6">
              <Icon name="heroicons:users" class="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 class="text-sm font-medium text-slate-600 mb-1">No stakeholders yet</h3>
              <p class="text-xs text-slate-400 max-w-xs mx-auto">
                Generate an invite link and share it with your external stakeholders
              </p>
            </div>

            <!-- Stakeholders List -->
            <div v-else class="divide-y divide-slate-100">
              <div
                v-for="stakeholder in stakeholders"
                :key="stakeholder.id"
                class="px-6 py-4 hover:bg-slate-50 transition-colors"
              >
                <div class="flex items-start gap-3">
                  <!-- Avatar -->
                  <div class="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <span v-if="!stakeholder.avatar" class="text-sm text-white font-medium">
                      {{ (stakeholder.name || stakeholder.email)[0].toUpperCase() }}
                    </span>
                    <img v-else :src="stakeholder.avatar" class="w-10 h-10 rounded-full" />
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-medium text-slate-900 truncate">
                        {{ stakeholder.name || 'No name' }}
                      </p>
                      <span v-if="stakeholder.position" class="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {{ stakeholder.position }}
                      </span>
                    </div>
                    <p class="text-xs text-slate-500 truncate mt-0.5">
                      {{ stakeholder.email }}
                    </p>
                    <div class="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>Joined {{ formatDate(stakeholder.invitedAt) }}</span>
                      <span v-if="stakeholder.stats.informationRequests > 0">
                        · {{ stakeholder.stats.informationRequests }} {{ stakeholder.stats.informationRequests === 1 ? 'request' : 'requests' }}
                      </span>
                      <span v-if="stakeholder.stats.externalTasks > 0">
                        · {{ stakeholder.stats.externalTasks }} {{ stakeholder.stats.externalTasks === 1 ? 'task' : 'tasks' }}
                      </span>
                    </div>
                  </div>

                  <!-- Remove button -->
                  <button
                    @click="removeStakeholder(stakeholder)"
                    :disabled="removingId === stakeholder.id"
                    class="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Remove from space"
                  >
                    <Icon 
                      v-if="removingId === stakeholder.id"
                      name="heroicons:arrow-path" 
                      class="w-4 h-4 animate-spin" 
                    />
                    <Icon v-else name="heroicons:trash" class="w-4 h-4" />
                  </button>
                </div>

                <!-- Permissions Row -->
                <div class="mt-3 pl-[52px] flex items-center gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <button
                      @click="toggleTaskPermission(stakeholder)"
                      :disabled="togglingTaskPermission === stakeholder.id"
                      :class="[
                        'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                        stakeholder.canSubmitTasks ? 'bg-violet-600' : 'bg-slate-200'
                      ]"
                    >
                      <span
                        :class="[
                          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                          stakeholder.canSubmitTasks ? 'translate-x-4' : 'translate-x-0'
                        ]"
                      />
                    </button>
                    <span class="text-xs text-slate-600">Can submit tasks</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-3 border-t border-slate-100 flex justify-end flex-shrink-0">
            <button
              @click="handleClose"
              class="px-4 py-2 text-sm font-normal text-slate-600 hover:text-slate-800 transition-colors"
            >
              Done
            </button>
          </div>
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
