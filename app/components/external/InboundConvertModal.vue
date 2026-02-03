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
  confirm: [title: string]
}>()

const title = ref('')
const submitting = ref(false)

// Extract suggested title from content
const extractTitle = (content: string): string => {
  const firstLine = content.split('\n')[0].trim()
  if (firstLine.length > 0 && firstLine.length <= 80) {
    return firstLine
      .replace(/^(feature suggestion:|suggestion:|idea:|feature:|request:)/i, '')
      .trim()
  }
  return content.substring(0, 60) + (content.length > 60 ? '...' : '')
}

const handleSubmit = async () => {
  if (!title.value.trim()) return
  submitting.value = true
  
  try {
    emit('confirm', title.value.trim())
    title.value = ''
  } finally {
    submitting.value = false
  }
}

const handleClose = () => {
  title.value = ''
  emit('close')
}

// Pre-populate title on open
watch(() => props.open, (open) => {
  if (open && props.item) {
    title.value = extractTitle(props.item.content)
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
              Convert Suggestion to Task
            </h2>
            <p class="text-xs text-slate-400 mt-0.5">
              Create a new task from {{ item.submitter.displayName }}'s suggestion
            </p>
          </div>
          
          <!-- Content -->
          <div class="p-6 space-y-4">
            <!-- Original suggestion -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1.5">
                Original Suggestion
              </label>
              <div class="bg-slate-50 rounded-lg p-4">
                <p class="text-sm text-slate-700">{{ item.content }}</p>
              </div>
            </div>
            
            <!-- Task title -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1.5">
                Task Title
              </label>
              <input
                v-model="title"
                type="text"
                placeholder="Enter a title for the new task..."
                class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                autofocus
              />
            </div>
            
            <!-- Info note -->
            <div class="flex items-start gap-2 text-xs text-slate-400">
              <Icon name="heroicons:information-circle" class="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p>
                The task will be created in your project's backlog. 
                The original suggestion text will be included in the description.
              </p>
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
              :disabled="!title.trim() || submitting"
              class="px-4 py-2 text-sm font-normal text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {{ submitting ? 'Creating...' : 'Create Task' }}
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
