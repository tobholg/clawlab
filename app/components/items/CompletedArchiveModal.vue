<script setup lang="ts">
import { CATEGORY_COLORS } from '~/types'

const props = defineProps<{
  open: boolean
  parentItemId: string
}>()

const emit = defineEmits<{
  close: []
  openDetail: [item: any]
}>()

// Filters
const search = ref('')
const sort = ref<'newest' | 'oldest' | 'title'>('newest')
const period = ref<'all' | '30d' | '7d'>('all')
const page = ref(1)
const pageSize = 20

// Debounced search
const debouncedSearch = ref('')
let searchTimeout: ReturnType<typeof setTimeout> | null = null
watch(search, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    debouncedSearch.value = val
    page.value = 1
  }, 300)
})

// Reset filters when modal opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    search.value = ''
    debouncedSearch.value = ''
    sort.value = 'newest'
    period.value = 'all'
    page.value = 1
  }
})

// Reset page on filter change
watch([sort, period], () => {
  page.value = 1
})

// Fetch data
const loading = ref(false)
const items = ref<any[]>([])
const total = ref(0)

const fetchItems = async () => {
  if (!props.open || !props.parentItemId) return
  loading.value = true
  try {
    const data = await $fetch<{ items: any[]; total: number; page: number; pageSize: number }>(
      `/api/items/${props.parentItemId}/done-children`,
      {
        params: {
          page: page.value,
          pageSize,
          period: period.value,
          search: debouncedSearch.value || undefined,
          sort: sort.value,
        },
      }
    )
    items.value = data.items
    total.value = data.total
  } catch (e) {
    console.error('Failed to fetch completed items:', e)
  } finally {
    loading.value = false
  }
}

watch([() => props.open, () => props.parentItemId, page, sort, period, debouncedSearch], () => {
  if (props.open) fetchItems()
}, { immediate: true })

// Pagination computed
const totalPages = computed(() => Math.ceil(total.value / pageSize))
const showingFrom = computed(() => total.value === 0 ? 0 : (page.value - 1) * pageSize + 1)
const showingTo = computed(() => Math.min(page.value * pageSize, total.value))

// Category dot color
const categoryDotColors: Record<string, string> = {
  Engineering: 'bg-blue-500',
  Bug: 'bg-rose-500',
  Design: 'bg-violet-500',
  Product: 'bg-indigo-500',
  QA: 'bg-amber-500',
  Research: 'bg-cyan-500',
  Operations: 'bg-orange-500',
  Marketing: 'bg-pink-500',
}

// Relative date formatter
const formatRelativeDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

const handleClose = () => {
  emit('close')
}

const sortOptions = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'title', label: 'A-Z' },
]

const periodOptions = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: 'Last 30 days' },
  { value: '7d', label: 'Last 7 days' },
]
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex justify-end"
      >
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/40"
          @click="handleClose"
        />

        <!-- Panel -->
        <div class="panel relative bg-white dark:bg-dm-card shadow-2xl w-full max-w-xl 2xl:max-w-3xl h-full flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between shrink-0">
            <div class="flex items-center gap-2">
              <Icon name="heroicons:archive-box" class="w-5 h-5 text-emerald-500" />
              <h2 class="text-base font-medium text-slate-900 dark:text-zinc-100">Completed Items</h2>
            </div>
            <button
              @click="handleClose"
              class="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>

          <!-- Filters bar -->
          <div class="px-6 py-3 border-b border-slate-100 dark:border-white/[0.06] flex flex-col gap-3 shrink-0">
            <!-- Search + Sort -->
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <Icon name="heroicons:magnifying-glass" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  v-model="search"
                  type="text"
                  placeholder="Search completed items..."
                  class="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-zinc-600 dark:text-zinc-200 dark:placeholder-zinc-500 transition-all"
                />
              </div>
              <select
                v-model="sort"
                class="text-xs px-2.5 py-1.5 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] rounded-lg text-slate-600 dark:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-zinc-600"
              >
                <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>

            <!-- Period pills -->
            <div class="flex items-center gap-1.5">
              <button
                v-for="opt in periodOptions"
                :key="opt.value"
                @click="period = opt.value as typeof period"
                :class="[
                  'px-2.5 py-1 text-xs rounded-full border transition-colors',
                  period === opt.value
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-medium'
                    : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/[0.1]'
                ]"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto">
            <!-- Loading -->
            <div v-if="loading" class="flex items-center justify-center py-12">
              <Icon name="heroicons:arrow-path" class="w-5 h-5 text-slate-400 animate-spin" />
              <span class="text-sm text-slate-400 ml-2">Loading...</span>
            </div>

            <!-- Empty state -->
            <div v-else-if="items.length === 0" class="flex flex-col items-center justify-center py-16 px-6">
              <Icon name="heroicons:archive-box-x-mark" class="w-10 h-10 text-slate-300 dark:text-zinc-600 mb-3" />
              <p class="text-sm text-slate-500 dark:text-zinc-400">No completed items found</p>
              <p v-if="debouncedSearch" class="text-xs text-slate-400 dark:text-zinc-500 mt-1">Try adjusting your search or filters</p>
            </div>

            <!-- Items list -->
            <div v-else class="divide-y divide-slate-100 dark:divide-white/[0.06]">
              <button
                v-for="item in items"
                :key="item.id"
                @click="emit('openDetail', item)"
                class="w-full flex items-center gap-3 px-6 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors group"
              >
                <!-- Category dot -->
                <div
                  class="w-2 h-2 rounded-full shrink-0"
                  :class="item.category ? (categoryDotColors[item.category] || 'bg-slate-400') : 'bg-slate-300'"
                  :title="item.category || 'No category'"
                />

                <!-- Title + meta -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-slate-800 dark:text-zinc-200 truncate group-hover:text-slate-900 dark:group-hover:text-zinc-100">
                    {{ item.title }}
                  </p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span v-if="item.category" class="text-[10px] text-slate-400 dark:text-zinc-500">{{ item.category }}</span>
                    <span v-if="item.category && item.updatedAt" class="text-slate-300 dark:text-zinc-600 text-[10px]">&middot;</span>
                    <span v-if="item.updatedAt" class="text-[10px] text-slate-400 dark:text-zinc-500">{{ formatRelativeDate(item.updatedAt) }}</span>
                  </div>
                </div>

                <!-- Owner avatar -->
                <div v-if="item.owner" class="shrink-0">
                  <div
                    class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center"
                    :title="item.owner.name"
                  >
                    <span class="text-[10px] text-white font-medium">{{ item.owner.name?.[0] ?? 'U' }}</span>
                  </div>
                </div>

                <!-- Arrow -->
                <Icon name="heroicons:chevron-right" class="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          </div>

          <!-- Pagination footer -->
          <div v-if="total > 0" class="px-6 py-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between shrink-0">
            <span class="text-xs text-slate-500 dark:text-zinc-400">
              Showing {{ showingFrom }}&ndash;{{ showingTo }} of {{ total }}
            </span>
            <div class="flex items-center gap-1">
              <button
                :disabled="page <= 1"
                @click="page--"
                class="px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span class="text-xs text-slate-400 dark:text-zinc-500 px-2">{{ page }} / {{ totalPages }}</span>
              <button
                :disabled="page >= totalPages"
                @click="page++"
                class="px-2.5 py-1 text-xs rounded-md border border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Backdrop fade */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Panel slide-in from right */
.modal-enter-active .panel,
.modal-leave-active .panel {
  transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.modal-enter-from .panel,
.modal-leave-to .panel {
  transform: translateX(100%);
}
</style>
