<script setup lang="ts">
import { CATEGORY_COLORS } from '~/types'

const props = defineProps<{
  open: boolean
  parentTitle?: string
  isProject?: boolean
}>()

const emit = defineEmits<{
  close: []
  create: [item: { title: string; description?: string; category?: string; dueDate?: string }]
}>()

const title = ref('')
const description = ref('')
const category = ref('')
const dueDate = ref('')

const categories = Object.keys(CATEGORY_COLORS)

const handleSubmit = () => {
  if (!title.value.trim()) return
  
  emit('create', {
    title: title.value.trim(),
    description: description.value.trim() || undefined,
    category: category.value || undefined,
    dueDate: dueDate.value || undefined,
  })
  
  // Reset form
  title.value = ''
  description.value = ''
  category.value = ''
  dueDate.value = ''
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
            
            <!-- Category & Due Date row -->
            <div class="flex gap-4">
              <!-- Category -->
              <div class="flex-1">
                <label class="block text-xs font-medium text-slate-500 mb-1.5">
                  Category
                </label>
                <select
                  v-model="category"
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all bg-white"
                >
                  <option value="">None</option>
                  <option v-for="cat in categories" :key="cat" :value="cat">
                    {{ cat }}
                  </option>
                </select>
              </div>
              
              <!-- Due Date -->
              <div class="flex-1">
                <label class="block text-xs font-medium text-slate-500 mb-1.5">
                  Due Date
                </label>
                <input
                  v-model="dueDate"
                  type="date"
                  class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
                />
              </div>
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
</style>
