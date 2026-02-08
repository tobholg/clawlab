<script setup lang="ts">
const props = defineProps<{
  open: boolean
  seatId: string | null
  memberName?: string
}>()

const emit = defineEmits<{
  close: []
  done: []
}>()

const { freeSeat, removeSeat } = useSeats()

const acting = ref(false)
const error = ref<string | null>(null)

const handleFreeUp = async () => {
  if (!props.seatId) return
  acting.value = true
  error.value = null
  try {
    await freeSeat(props.seatId)
    emit('done')
    emit('close')
  } catch (e: any) {
    error.value = e?.data?.message || 'Failed to free seat'
  } finally {
    acting.value = false
  }
}

const handleRemove = async () => {
  if (!props.seatId) return
  acting.value = true
  error.value = null
  try {
    await removeSeat(props.seatId)
    emit('done')
    emit('close')
  } catch (e: any) {
    error.value = e?.data?.message || 'Failed to remove seat'
  } finally {
    acting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open && seatId"
        class="fixed inset-0 z-[200] flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="emit('close')" />
        <div class="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
          <h2 class="text-lg font-medium text-slate-900 mb-1">What to do with this seat?</h2>
          <p class="text-sm text-slate-500 mb-5">
            {{ memberName ? `${memberName} has been deactivated.` : 'The member has been deactivated.' }}
            Choose what happens to their seat.
          </p>

          <div class="space-y-3">
            <button
              @click="handleFreeUp"
              :disabled="acting"
              class="w-full p-4 text-left rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name="heroicons:arrow-path" class="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div>
                  <p class="text-sm font-medium text-slate-900">Free up seat</p>
                  <p class="text-xs text-slate-500 mt-0.5">Keep the seat available for a future invite. You'll continue paying for it.</p>
                </div>
              </div>
            </button>

            <button
              @click="handleRemove"
              :disabled="acting"
              class="w-full p-4 text-left rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name="heroicons:trash" class="w-4.5 h-4.5 text-red-600" />
                </div>
                <div>
                  <p class="text-sm font-medium text-slate-900">Remove from billing</p>
                  <p class="text-xs text-slate-500 mt-0.5">Delete the seat entirely. It will no longer appear on your bill.</p>
                </div>
              </div>
            </button>
          </div>

          <p v-if="error" class="text-xs text-red-500 mt-3">{{ error }}</p>

          <button
            @click="emit('close')"
            class="w-full mt-4 px-4 py-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Decide later
          </button>
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
