<script setup lang="ts">
interface InboundIR {
  id: string
  type: 'question' | 'suggestion'
  content: string
  submitter: {
    displayName: string
    position?: string
  }
}

const props = defineProps<{
  open: boolean
  item: InboundIR | null
}>()

const emit = defineEmits<{
  close: []
  confirm: [response: string]
}>()

const response = ref('')
const submitting = ref(false)

const handleSubmit = async () => {
  if (!response.value.trim()) return
  submitting.value = true
  
  try {
    emit('confirm', response.value.trim())
    response.value = ''
  } finally {
    submitting.value = false
  }
}

const handleClose = () => {
  response.value = ''
  emit('close')
}

// Reset on open
watch(() => props.open, (open) => {
  if (open) {
    response.value = ''
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
        <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100">
            <h2 class="text-base font-medium text-slate-900">
              Respond to {{ item.type === 'question' ? 'Question' : 'Suggestion' }}
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              From {{ item.submitter.displayName }}
              <span v-if="item.submitter.position"> · {{ item.submitter.position }}</span>
            </p>
          </div>
          
          <!-- Content -->
          <div class="p-6 space-y-4">
            <!-- Original question/suggestion -->
            <div class="bg-slate-50 rounded-lg p-4">
              <p class="text-sm text-slate-700">{{ item.content }}</p>
            </div>
            
            <!-- Response input -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1.5">
                Your Response
              </label>
              <textarea
                v-model="response"
                rows="4"
                placeholder="Write your response..."
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all resize-none"
                autofocus
              />
            </div>
            
            <!-- Info note -->
            <p class="text-xs text-slate-400">
              Your response will be visible to all stakeholders in this space.
            </p>
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
              :disabled="!response.trim() || submitting"
              class="px-4 py-2 text-sm font-normal text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {{ submitting ? 'Sending...' : 'Send Response' }}
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
