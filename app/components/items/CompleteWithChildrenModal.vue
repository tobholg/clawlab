<script setup lang="ts">
const props = defineProps<{
  open: boolean
  title?: string
  maxDepth?: number
  loading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/30" @click="emit('cancel')" />
        <div class="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h3 class="text-base font-medium text-slate-900 dark:text-slate-100">Complete with subtasks?</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              This item has incomplete subtasks. You can cancel or complete all subtasks{{ maxDepth ? ` (up to ${maxDepth} levels)` : '' }}.
            </p>
          </div>

          <div class="px-5 py-4">
            <div v-if="title" class="text-sm text-slate-700 dark:text-slate-300 font-medium">
              {{ title }}
            </div>
            <div v-if="error" class="mt-2 text-xs text-rose-600 dark:text-rose-400">
              {{ error }}
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <button
              class="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
              @click="emit('cancel')"
            >
              Cancel
            </button>
            <button
              class="px-3 py-1.5 text-xs text-white dark:text-slate-900 bg-slate-900 dark:bg-slate-100 rounded-md hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              :disabled="loading"
              @click="emit('confirm')"
            >
              {{ loading ? 'Completing…' : 'Complete all & mark done' }}
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
  transform: translateY(6px);
}
</style>
