<script setup lang="ts">
interface SpaceUpdateItem {
  id: string
  title: string
  summary: string
  risks: Array<{ text: string }>
  wins: Array<{ text: string }>
  status: string
  publishedAt: string | null
  createdAt: string
  generatedBy: { name: string | null }
}

const props = defineProps<{
  update: SpaceUpdateItem
  isTeamMember?: boolean
  projectName?: string
}>()

const emit = defineEmits<{
  publish: [id: string]
  discard: [id: string]
}>()

const formatRelativeDate = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return '1 week ago'
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 60) return '1 month ago'
  return `${Math.floor(diffDays / 30)} months ago`
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="bg-white dark:bg-dm-card border border-slate-100 dark:border-white/[0.06] rounded-2xl p-5 shadow-sm dark:shadow-none">
    <!-- Header -->
    <div class="mb-3">
      <h3 class="text-lg font-semibold text-slate-900 dark:text-zinc-100">{{ update.title }}</h3>
      <p class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
        <span v-if="projectName">{{ projectName }}</span>
        <span v-if="projectName"> · </span>
        {{ formatDate(update.publishedAt || update.createdAt) }}
      </p>
    </div>

    <!-- Summary -->
    <p class="text-base text-slate-600 dark:text-zinc-300 leading-relaxed mb-4 whitespace-pre-line">{{ update.summary }}</p>

    <!-- Wins -->
    <div v-if="(update.wins as Array<{text: string}>)?.length > 0" class="mb-4">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-2 h-2 rounded-full bg-emerald-400" />
        <span class="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Wins</span>
      </div>
      <div class="space-y-3">
        <div
          v-for="(win, i) in (update.wins as Array<{text: string}>)"
          :key="i"
          class="text-base text-slate-600 dark:text-zinc-300 pl-3 border-l-2 border-emerald-300 dark:border-emerald-500/40 py-0.5"
        >
          {{ win.text }}
        </div>
      </div>
    </div>

    <!-- Risks -->
    <div v-if="(update.risks as Array<{text: string}>)?.length > 0" class="mb-4">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-2 h-2 rounded-full bg-amber-400" />
        <span class="text-sm font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Risks</span>
      </div>
      <div class="space-y-3">
        <div
          v-for="(risk, i) in (update.risks as Array<{text: string}>)"
          :key="i"
          class="text-base text-slate-600 dark:text-zinc-300 pl-3 border-l-2 border-amber-300 dark:border-amber-500/40 py-0.5"
        >
          {{ risk.text }}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/[0.06]">
      <div class="flex items-center gap-2">
        <span
          :class="[
            'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider',
            update.status === 'PUBLISHED'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
          ]"
        >
          {{ update.status === 'PUBLISHED' ? 'Published' : 'Draft' }}
        </span>
        <span class="text-xs text-slate-400 dark:text-zinc-500">
          {{ formatRelativeDate(update.publishedAt || update.createdAt) }}
        </span>
      </div>

      <!-- Team member actions for drafts -->
      <div v-if="isTeamMember && update.status === 'DRAFT'" class="flex items-center gap-2">
        <button
          @click="emit('publish', update.id)"
          class="px-3 py-1 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
        >
          Publish
        </button>
        <button
          @click="emit('discard', update.id)"
          class="px-3 py-1 bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-zinc-300 text-xs font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-white/[0.1] transition-colors"
        >
          Discard
        </button>
      </div>
    </div>
  </div>
</template>
