<script setup lang="ts">
interface CompletedTask {
  id: string
  title: string
  startDate: string | null
  completedAt: string | null
  durationDays: number | null
  childrenCount: number
  children: CompletedTask[]
}

const props = defineProps<{
  tasks: CompletedTask[]
  title?: string
  emptyMessage?: string
  emptyIcon?: string
}>()


</script>

<template>
  <section>
    <!-- Section header -->
    <div v-if="title" class="flex items-center gap-3 mb-4">
      <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wider">
        {{ title }}
      </h2>
      <div class="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
      <span class="text-xs text-slate-400 font-medium">
        {{ tasks.length }} item{{ tasks.length !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Empty state -->
    <div
      v-if="tasks.length === 0"
      class="bg-white border border-slate-100 rounded-2xl p-10 text-center shadow-sm"
    >
      <div class="w-14 h-14 mx-auto mb-4 bg-slate-50 rounded-2xl flex items-center justify-center">
        <Icon
          :name="emptyIcon || 'heroicons:check-badge'"
          class="w-7 h-7 text-slate-300"
        />
      </div>
      <p class="text-slate-500 text-sm">
        {{ emptyMessage || 'No completed items yet' }}
      </p>
    </div>

    <!-- Completed task list -->
    <div v-else class="space-y-3">
      <StakeholderCompletedTaskCard
        v-for="task in tasks"
        :key="task.id"
        :task="task"
      />
    </div>
  </section>
</template>
