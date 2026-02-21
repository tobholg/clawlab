<script setup lang="ts">
import type { ItemNode } from '~/types'
import { PRIORITY_OPTIONS, COMPLEXITY_OPTIONS } from '~/types'

const props = defineProps<{
  open: boolean
  items: ItemNode[]
}>()

const emit = defineEmits<{
  close: []
  select: [item: ItemNode]
}>()

const priorityScoreMap: Record<string, number> = {
  CRITICAL: 100,
  HIGH: 80,
  MEDIUM: 55,
  LOW: 30,
}

const complexityScoreMap: Record<string, number> = {
  TRIVIAL: 100,
  SMALL: 85,
  MEDIUM: 60,
  LARGE: 35,
  EPIC: 15,
}

const priorityDotColors: Record<string, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-amber-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-rose-500',
}

const complexityDotColors: Record<string, string> = {
  TRIVIAL: 'bg-emerald-500',
  SMALL: 'bg-green-500',
  MEDIUM: 'bg-amber-500',
  LARGE: 'bg-orange-500',
  EPIC: 'bg-rose-500',
}

const priorityLabelMap: Record<string, string> = Object.fromEntries(
  PRIORITY_OPTIONS.map(opt => [opt.value, opt.label])
)

const complexityLabelMap: Record<string, string> = Object.fromEntries(
  COMPLEXITY_OPTIONS.map(opt => [opt.value, opt.label])
)

const calculateScore = (item: ItemNode) => {
  const priorityKey = item.priority ?? 'MEDIUM'
  const complexityKey = item.complexity ?? 'MEDIUM'
  const priorityScore = priorityScoreMap[priorityKey] ?? 55
  const complexityScore = complexityScoreMap[complexityKey] ?? 60
  return Math.round(priorityScore * 0.7 + complexityScore * 0.3)
}

const suggestedItems = computed(() => {
  const results: Array<{
    item: ItemNode
    score: number
    isChild: boolean
    parentTitle?: string
  }> = []

  props.items.forEach(item => {
    if (item.status !== 'done') {
      results.push({
        item,
        score: calculateScore(item),
        isChild: false,
      })
    }

    if (item.children?.length) {
      item.children.forEach(child => {
        if (child.status === 'done') return
        results.push({
          item: child,
          score: calculateScore(child),
          isChild: true,
          parentTitle: item.title,
        })
      })
    }
  })

  return results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    const aDue = a.item.dueDate ? new Date(a.item.dueDate).getTime() : Infinity
    const bDue = b.item.dueDate ? new Date(b.item.dueDate).getTime() : Infinity
    if (aDue !== bDue) return aDue - bDue
    return a.item.title.localeCompare(b.item.title)
  })
})

const handleSelect = (item: ItemNode) => {
  emit('select', item)
}
</script>

<template>
  <Teleport to="body">
    <Transition name="workorder">
      <div v-if="open" class="fixed inset-0 z-50 flex justify-end">
        <div class="absolute inset-0 bg-black/30" @click="$emit('close')" />

        <div class="panel relative bg-white dark:bg-dm-panel w-full max-w-lg h-full flex flex-col shadow-2xl border-l border-transparent dark:border-white/[0.06]">
          <div class="px-6 py-5 border-b border-slate-100 dark:border-white/[0.06] flex items-center justify-between">
            <div>
              <div class="text-xs uppercase tracking-wider text-slate-400 dark:text-zinc-500">Suggested work order</div>
              <div class="text-lg font-medium text-slate-900 dark:text-zinc-100 mt-1">Focus next, with confidence</div>
              <p class="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Ranked by priority and effort for the current level and one level down.
              </p>
            </div>
            <button
              @click="$emit('close')"
              class="w-8 h-8 flex items-center justify-center rounded-md text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <Icon name="heroicons:x-mark" class="w-5 h-5" />
            </button>
          </div>

          <div class="p-6 space-y-3 overflow-y-auto flex-1">
            <div v-if="suggestedItems.length === 0" class="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-slate-50 dark:bg-white/[0.03] p-6 text-center text-sm text-slate-500 dark:text-zinc-400">
              No suggested items yet.
            </div>

            <button
              v-for="(entry, index) in suggestedItems"
              :key="entry.item.id"
              class="w-full text-left rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.03] p-4 hover:border-slate-300 dark:hover:border-white/[0.1] hover:shadow-sm transition-all"
              @click="handleSelect(entry.item)"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium text-slate-900 dark:text-zinc-200 truncate">{{ entry.item.title }}</div>
                  <div v-if="entry.isChild" class="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                    Under {{ entry.parentTitle }}
                  </div>
                </div>
                <div
                  class="text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
                  :class="entry.score >= 80
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                    : entry.score >= 65
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400'
                      : entry.score >= 50
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                        : entry.score >= 35
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400'
                          : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-400'"
                >
                  Score {{ entry.score }}
                </div>
              </div>

              <div class="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
                <div class="flex items-center gap-1.5">
                  <div
                    class="w-2 h-2 rounded-full"
                    :class="entry.item.category ? 'bg-slate-400 dark:bg-zinc-500' : 'bg-slate-300 dark:bg-zinc-600'"
                  />
                  <span>{{ entry.item.category || 'No category' }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full" :class="priorityDotColors[entry.item.priority ?? 'MEDIUM'] || 'bg-slate-300'" />
                  <span>{{ priorityLabelMap[entry.item.priority ?? 'MEDIUM'] ?? 'Medium' }}</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <div class="w-2 h-2 rounded-full" :class="complexityDotColors[entry.item.complexity ?? 'MEDIUM'] || 'bg-slate-300'" />
                  <span>{{ complexityLabelMap[entry.item.complexity ?? 'MEDIUM'] ?? 'Medium' }}</span>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.workorder-enter-active,
.workorder-leave-active {
  transition: opacity 0.2s ease;
}

.workorder-enter-from,
.workorder-leave-to {
  opacity: 0;
}

.workorder-enter-active .panel,
.workorder-leave-active .panel {
  transition: transform 0.25s ease, opacity 0.25s ease;
}

.workorder-enter-from .panel,
.workorder-leave-to .panel {
  transform: translateX(18px);
  opacity: 0;
}
</style>
