<script setup lang="ts">
import type { ItemNode } from '~/types'
import { flattenDescendants } from '~/utils/itemTree'
import { getItemEstimateMeta } from '~/utils/itemRisk'

const props = defineProps<{
  open: boolean
  mode: 'at-risk' | 'blocked'
  rootItem: ItemNode | null
}>()

const emit = defineEmits<{
  close: []
  openDetail: [item: ItemNode]
  drillDown: [item: ItemNode]
}>()

const title = computed(() => (props.mode === 'blocked' ? 'Blocked items' : 'At-risk items'))
const description = computed(() => {
  if (props.mode === 'blocked') {
    return 'Blocked items are explicitly marked as blocked (not just dependent).'
  }
  return 'At-risk items have an estimated completion date likely beyond their due date.'
})
const modePillClasses = computed(() => (
  props.mode === 'blocked'
    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
))
const modeBorderClasses = computed(() => (
  props.mode === 'blocked'
    ? 'border-rose-200/70 dark:border-rose-500/20'
    : 'border-amber-200/70 dark:border-amber-500/20'
))

const entries = computed(() => {
  if (!props.rootItem) return []
  const all = flattenDescendants(props.rootItem, 4)
  if (props.mode === 'blocked') {
    return all.filter(entry => entry.item.status === 'blocked')
  }
  return all.filter(entry => getItemEstimateMeta(entry.item).isAtRisk)
})

const entryData = computed(() =>
  entries.value.map(entry => ({
    ...entry,
    meta: getItemEstimateMeta(entry.item),
  }))
)

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sidepanel">
      <div v-if="open && rootItem" class="fixed inset-0 z-50 flex justify-end">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-black/30" @click="emit('close')" />

        <!-- Panel -->
        <div class="panel relative bg-white dark:bg-dm-card shadow-2xl w-full max-w-lg h-full flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-slate-100 dark:border-white/[0.06]">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-slate-900 dark:text-zinc-100">{{ title }}</h2>
                <p class="text-xs text-slate-500 dark:text-zinc-400 mt-1">{{ description }}</p>
              </div>
              <button
                class="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-white/[0.06] transition-colors"
                @click="emit('close')"
                aria-label="Close"
              >
                <Icon name="heroicons:x-mark" class="w-4 h-4" />
              </button>
            </div>
            <div class="mt-3 text-xs text-slate-500 dark:text-zinc-500">
              From: <span class="text-slate-700 dark:text-zinc-200 font-medium">{{ rootItem.title }}</span>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-3">
            <div v-if="entryData.length === 0" class="text-sm text-slate-400 dark:text-zinc-500 text-center py-12">
              No items to show.
            </div>

            <div
              v-for="entry in entryData"
              :key="entry.item.id"
              class="p-4 rounded-xl border hover:shadow-sm transition-all cursor-pointer"
              :class="['border-slate-200 hover:border-slate-300 dark:border-white/[0.06] dark:hover:border-white/[0.09]', modeBorderClasses]"
              @click="emit('openDetail', entry.item)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-slate-800 dark:text-zinc-200 truncate">{{ entry.item.title }}</div>
                  <div class="mt-1 text-[11px] text-slate-500 dark:text-zinc-500 flex flex-wrap items-center gap-1">
                    <template v-for="(node, index) in entry.path" :key="node.id">
                      <span :class="index === entry.path.length - 1 ? 'text-slate-700 dark:text-zinc-300' : 'text-slate-500 dark:text-zinc-500'">
                        {{ node.title }}
                      </span>
                      <Icon
                        v-if="index < entry.path.length - 1"
                        name="heroicons:chevron-right"
                        class="w-3 h-3 text-slate-300 dark:text-zinc-600"
                      />
                    </template>
                  </div>
                </div>
                <button
                  class="text-xs text-slate-500 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300"
                  @click.stop="emit('openDetail', entry.item)"
                >
                  Open
                </button>
              </div>

              <div class="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-zinc-500">
                <span v-if="entry.item.dueDate">Due {{ formatDate(entry.item.dueDate) }}</span>
                <span v-if="mode === 'at-risk'">Miss {{ entry.meta.missProb }}%</span>
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-medium"
                  :class="modePillClasses"
                >
                  {{ mode === 'blocked' ? 'Blocked' : 'At risk' }}
                </span>
                <button
                  v-if="(entry.item.childrenCount ?? 0) > 0"
                  class="text-slate-500 hover:text-slate-700 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors"
                  @click.stop="emit('drillDown', entry.item)"
                >
                  {{ entry.item.childrenCount }} items
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sidepanel-enter-active,
.sidepanel-leave-active {
  transition: opacity 0.2s ease;
}

.sidepanel-enter-from,
.sidepanel-leave-to {
  opacity: 0;
}

.sidepanel-enter-active .panel,
.sidepanel-leave-active .panel {
  transition: transform 0.25s ease;
}

.sidepanel-enter-from .panel,
.sidepanel-leave-to .panel {
  transform: translateX(100%);
}
</style>
