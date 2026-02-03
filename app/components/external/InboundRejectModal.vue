<script setup lang="ts">
interface InboundItem {
  id: string
  type: 'task' | 'question' | 'suggestion'
  submitter: {
    displayName: string
  }
}

const props = defineProps<{
  open: boolean
  item: InboundItem | null
}>()

const emit = defineEmits<{
  close: []
  confirm: [reason: string]
}>()

const reason = ref('')
const submitting = ref(false)

const actionLabel = computed(() => {
  if (!props.item) return 'Reject'
  return props.item.type === 'task' ? 'Reject' : 'Decline'
})

const handleSubmit = async () => {
  submitting.value = true
  
  try {
    emit('confirm', reason.value.trim())
    reason.value = ''
  } finally {
    submitting.value = false
  }
}

const handleClose = () => {
  reason.value = ''
  emit('close')
}

// Reset on open
watch(() => props.open, (open) => {
  if (open) {
    reason.value = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open && item" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" @click="handleClose" />
        
        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100">
            <h2 class="text-base font-medium text-slate-900">
              {{ actionLabel }} {{ item.type === 'task' ? 'Task' : item.type === 'question' ? 'Question' : 'Suggestion' }}
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              This action cannot be undone
            </p>
          </div>
          
          <!-- Content -->
          <div class="p-6 space-y-4">
            <!-- Warning -->
            <div class="flex items-start gap-3 bg-red-50 text-red-700 rounded-lg p-4">
              <Icon name="heroicons:exclamation-triangle" class="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p class="text-sm">
                Are you sure you want to {{ actionLabel.toLowerCase() }} this {{ item.type }}?
                <span v-if="item.type === 'task'">The submitter will not be notified.</span>
              </p>
            </div>
            
            <!-- Reason input (optional) -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1.5">
                Reason <span class="text-slate-300 font-normal">(optional, internal only)</span>
              </label>
              <textarea
                v-model="reason"
                rows="2"
                placeholder="Add an internal note about why this was rejected..."
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all resize-none"
              />
            </div>
          </div>
          
          <!-- Actions -->
          <div class="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              @click="handleClose"
              class="px-4 py-2 text-sm font-normal text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleSubmit"
              :disabled="submitting"
              class="px-4 py-2 text-sm font-normal text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {{ submitting ? 'Processing...' : actionLabel }}
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
