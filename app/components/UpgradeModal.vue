<script setup lang="ts">
const props = defineProps<{
  open: boolean
  message?: string
}>()

const emit = defineEmits<{
  close: []
  viewPlans: []
}>()

const router = useRouter()

const handleViewPlans = () => {
  emit('close')
  router.push('/workspace/settings')
  // Wait for navigation, then switch to a relevant settings tab.
  nextTick(() => {
    window.dispatchEvent(new CustomEvent('switch-settings-tab', { detail: 'general' }))
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-[200] flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="emit('close')" />
        <div class="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
          <!-- Icon -->
          <div class="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <Icon name="heroicons:arrow-up-circle" class="w-6 h-6 text-amber-600" />
          </div>

          <h2 class="text-lg font-medium text-slate-900 text-center mb-2">Usage limit reached</h2>
          <p class="text-sm text-slate-500 text-center mb-6 leading-relaxed">
            {{ message || 'This action hit a configured workspace or organization limit.' }}
          </p>

          <div class="flex items-center gap-3">
            <button
              @click="emit('close')"
              class="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Maybe later
            </button>
            <button
              @click="handleViewPlans"
              class="flex-1 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              Open settings
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
</style>
