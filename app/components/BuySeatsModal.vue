<script setup lang="ts">
const props = defineProps<{
  open: boolean
  planTier?: string
  currentInternal?: number
  currentExternal?: number
  organizationId?: string | null
}>()

const emit = defineEmits<{
  close: []
  purchased: [count: number, type: string]
}>()

const { purchaseSeats } = useSeats()
const { MAX_PRO_SEATS, calculateMarginalCost, getMarginalBreakdown } = usePricing()

const count = ref(1)
const type = ref<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
const purchasing = ref(false)
const error = ref<string | null>(null)

const existing = computed(() => {
  return type.value === 'INTERNAL' ? (props.currentInternal ?? 0) : (props.currentExternal ?? 0)
})

const maxAdd = computed(() => Math.max(0, MAX_PRO_SEATS - existing.value))
const isAtCap = computed(() => existing.value >= MAX_PRO_SEATS)

const isFree = computed(() => props.planTier === 'FREE')

const marginalBreakdown = computed(() => {
  if (count.value < 1) return []
  return getMarginalBreakdown(existing.value, count.value, type.value)
})

const additionalCost = computed(() => {
  if (count.value < 1) return 0
  return calculateMarginalCost(existing.value, count.value, type.value)
})

const formatRate = (n: number) => n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`

const increment = () => {
  if (count.value < maxAdd.value) count.value++
}
const decrement = () => {
  if (count.value > 1) count.value--
}

const handlePurchase = async () => {
  purchasing.value = true
  error.value = null
  try {
    await purchaseSeats(count.value, type.value)
    emit('purchased', count.value, type.value)
    emit('close')
    count.value = 1
  } catch (e: any) {
    error.value = e?.data?.message || 'Failed to purchase seats'
  } finally {
    purchasing.value = false
  }
}

watch(() => props.open, (val) => {
  if (val) {
    count.value = 1
    type.value = 'INTERNAL'
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
        <div class="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
          <h2 class="text-lg font-medium text-slate-900 mb-1">Purchase seats</h2>
          <p class="text-sm text-slate-500 mb-5">Add more capacity to your organization</p>

          <div v-if="isFree" class="p-4 bg-amber-50 rounded-lg border border-amber-100 mb-5">
            <p class="text-sm text-amber-800">
              Upgrade to <strong>Pro</strong> first to purchase additional seats.
            </p>
          </div>

          <div v-else class="space-y-4">
            <!-- Seat type -->
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1.5">Seat type</label>
              <div class="flex gap-2">
                <button
                  @click="type = 'INTERNAL'"
                  :class="[
                    'flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
                    type === 'INTERNAL'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  ]"
                >
                  Internal
                </button>
                <button
                  @click="type = 'EXTERNAL'"
                  :class="[
                    'flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
                    type === 'EXTERNAL'
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  ]"
                >
                  External
                </button>
              </div>
            </div>

            <!-- Current count context -->
            <div class="text-xs text-slate-500">
              Currently <span class="font-medium text-slate-700">{{ existing }}</span> {{ type.toLowerCase() }} seats
              <span v-if="isAtCap" class="text-amber-600 font-medium">(at cap)</span>
            </div>

            <!-- At cap — enterprise CTA -->
            <div v-if="isAtCap" class="p-4 bg-violet-50 rounded-lg border border-violet-100">
              <p class="text-sm text-violet-800">
                You've reached the maximum of <strong>{{ MAX_PRO_SEATS }}</strong> {{ type.toLowerCase() }} seats on Pro.
                <a href="#" class="font-medium underline underline-offset-2">Contact sales</a> for Enterprise.
              </p>
            </div>

            <template v-else>
              <!-- Quantity -->
              <div>
                <label class="block text-xs font-medium text-slate-500 mb-1.5">Quantity</label>
                <div class="flex items-center gap-3">
                  <button
                    @click="decrement"
                    :disabled="count <= 1"
                    class="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30"
                  >
                    <Icon name="heroicons:minus" class="w-4 h-4" />
                  </button>
                  <span class="text-2xl font-semibold text-slate-900 tabular-nums w-12 text-center">{{ count }}</span>
                  <button
                    @click="increment"
                    :disabled="count >= maxAdd"
                    class="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-30"
                  >
                    <Icon name="heroicons:plus" class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Marginal breakdown -->
              <div class="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1">
                <div
                  v-for="(line, i) in marginalBreakdown"
                  :key="i"
                  class="flex items-center justify-between text-xs text-slate-500"
                >
                  <span>Seats {{ Math.max(line.bracket.min, existing + 1) }}–{{ Math.min(line.bracket.max, existing + count) }} <span class="text-slate-400">({{ line.count }})</span></span>
                  <span>{{ line.count }} x {{ formatRate(line.rate) }} = <span class="text-slate-700 font-medium">${{ line.subtotal }}/mo</span></span>
                </div>
                <div class="flex items-center justify-between text-sm pt-1 border-t border-slate-100">
                  <span class="text-slate-600">Additional monthly cost</span>
                  <span class="text-slate-900 font-semibold">${{ additionalCost }}/mo</span>
                </div>
              </div>
            </template>

            <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
          </div>

          <div class="flex items-center gap-3 mt-5">
            <button
              @click="emit('close')"
              class="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              v-if="!isFree && !isAtCap"
              @click="handlePurchase"
              :disabled="purchasing"
              class="flex-1 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {{ purchasing ? 'Purchasing...' : `Purchase ${count} ${count === 1 ? 'seat' : 'seats'}` }}
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
