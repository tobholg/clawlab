<script setup lang="ts">
const props = defineProps<{
  open: boolean
  occupiedInternal?: number
  occupiedExternal?: number
}>()

const emit = defineEmits<{
  close: []
  upgraded: []
}>()

const { workspaceId } = useItems()
const { fetchSeats } = useSeats()
const { MAX_PRO_SEATS, calculateSeatCost, getSeatBreakdown } = usePricing()

const minInternal = computed(() => Math.max(1, props.occupiedInternal ?? 1))
const minExternal = computed(() => props.occupiedExternal ?? 0)

const internalCount = ref(minInternal.value)
const externalCount = ref(minExternal.value)
const upgrading = ref(false)
const error = ref<string | null>(null)

const internalBreakdown = computed(() => getSeatBreakdown(internalCount.value, 'INTERNAL'))
const externalBreakdown = computed(() => externalCount.value > 0 ? getSeatBreakdown(externalCount.value, 'EXTERNAL') : [])

const internalCost = computed(() => calculateSeatCost(internalCount.value, 'INTERNAL'))
const externalCost = computed(() => externalCount.value > 0 ? calculateSeatCost(externalCount.value, 'EXTERNAL') : 0)
const totalCost = computed(() => internalCost.value + externalCost.value)
const totalSeats = computed(() => internalCount.value + externalCount.value)
const effectiveAvg = computed(() => totalSeats.value > 0 ? (totalCost.value / totalSeats.value).toFixed(2) : '0')

const handleUpgrade = async () => {
  if (!workspaceId.value || upgrading.value) return
  upgrading.value = true
  error.value = null
  try {
    await $fetch(`/api/workspaces/${workspaceId.value}/plan`, {
      method: 'PATCH',
      body: {
        planTier: 'PRO',
        internalSeats: internalCount.value,
        externalSeats: externalCount.value,
      },
    })
    await fetchSeats()
    emit('upgraded')
    emit('close')
  } catch (e: any) {
    error.value = e?.data?.message || 'Failed to upgrade'
  } finally {
    upgrading.value = false
  }
}

const formatRate = (n: number) => n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`

watch(() => props.open, (val) => {
  if (val) {
    internalCount.value = minInternal.value
    externalCount.value = minExternal.value
    error.value = null
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-[200] flex items-center justify-center"
      >
        <div class="absolute inset-0 bg-black/30 backdrop-blur-sm" @click="emit('close')" />
        <div class="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="flex items-center gap-3 mb-5">
            <div class="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Icon name="heroicons:rocket-launch" class="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 class="text-lg font-medium text-slate-900">Upgrade to Pro</h2>
              <p class="text-xs text-slate-500">Choose how many seats you need</p>
            </div>
          </div>

          <!-- AI credits benefit -->
          <div class="p-3 bg-violet-50 rounded-lg border border-violet-100 mb-5">
            <div class="flex items-center gap-2 text-sm text-violet-800">
              <Icon name="heroicons:sparkles" class="w-4 h-4 text-violet-600" />
              <strong>10,000 AI credits/user/mo</strong>
              <span class="text-violet-600">(100x more than Free)</span>
            </div>
          </div>

          <!-- Internal seats -->
          <div class="mb-4">
            <label class="block text-xs font-medium text-slate-500 mb-1.5">Internal seats</label>
            <div class="flex items-center gap-3">
              <input
                v-model.number="internalCount"
                type="number"
                :min="minInternal"
                :max="MAX_PRO_SEATS"
                class="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
              />
              <input
                v-model.number="internalCount"
                type="range"
                :min="minInternal"
                :max="MAX_PRO_SEATS"
                class="flex-1 accent-slate-900"
              />
            </div>
            <!-- Bracket breakdown -->
            <div v-if="internalBreakdown.length" class="mt-2 space-y-0.5">
              <div
                v-for="(line, i) in internalBreakdown"
                :key="i"
                class="flex items-center justify-between text-xs text-slate-500"
              >
                <span>Seats {{ line.bracket.min }}–{{ Math.min(line.bracket.max, internalCount) }} <span class="text-slate-400">({{ line.count }})</span></span>
                <span>{{ line.count }} x {{ formatRate(line.rate) }} = <span class="text-slate-700 font-medium">${{ line.subtotal }}/mo</span></span>
              </div>
            </div>
          </div>

          <!-- External seats -->
          <div class="mb-5">
            <label class="block text-xs font-medium text-slate-500 mb-1.5">External seats</label>
            <div class="flex items-center gap-3">
              <input
                v-model.number="externalCount"
                type="number"
                :min="minExternal"
                :max="MAX_PRO_SEATS"
                class="w-20 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
              />
              <input
                v-model.number="externalCount"
                type="range"
                :min="minExternal"
                :max="MAX_PRO_SEATS"
                class="flex-1 accent-slate-900"
              />
            </div>
            <div v-if="externalBreakdown.length" class="mt-2 space-y-0.5">
              <div
                v-for="(line, i) in externalBreakdown"
                :key="i"
                class="flex items-center justify-between text-xs text-slate-500"
              >
                <span>Seats {{ line.bracket.min }}–{{ Math.min(line.bracket.max, externalCount) }} <span class="text-slate-400">({{ line.count }})</span></span>
                <span>{{ line.count }} x {{ formatRate(line.rate) }} = <span class="text-slate-700 font-medium">${{ line.subtotal }}/mo</span></span>
              </div>
            </div>
          </div>

          <!-- Total -->
          <div class="p-4 bg-slate-50 rounded-lg border border-slate-100 mb-5">
            <div class="flex items-center justify-between">
              <span class="text-sm text-slate-600">Total monthly cost</span>
              <span class="text-2xl font-bold text-slate-900 tabular-nums">${{ totalCost }}/mo</span>
            </div>
            <p class="text-xs text-slate-400 mt-1 text-right">~{{ effectiveAvg }}/seat effective average</p>
          </div>

          <p v-if="error" class="text-xs text-red-500 mb-3">{{ error }}</p>

          <!-- Actions -->
          <div class="flex items-center gap-3">
            <button
              @click="emit('close')"
              class="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              @click="handleUpgrade"
              :disabled="upgrading"
              class="flex-1 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {{ upgrading ? 'Upgrading...' : 'Upgrade to Pro' }}
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
