<script setup lang="ts">
import type { TaskProposal, ProposedTask } from '~/types/ai'

const props = defineProps<{
  proposal: TaskProposal
  channelId: string
}>()

const accepting = ref(false)
const accepted = ref(false)
const error = ref<string | null>(null)

const { refreshItems } = useItems()

type FlatTask = ProposedTask & { depth: number }

const flatTasks = computed(() => {
  const out: FlatTask[] = []
  const walk = (tasks: ProposedTask[], depth: number) => {
    for (const task of tasks) {
      out.push({ ...task, depth })
      if (task.children && task.children.length > 0) {
        walk(task.children, depth + 1)
      }
    }
  }
  walk(props.proposal.tasks || [], 0)
  return out
})

const canAccept = computed(() => Boolean(props.proposal.projectId))

const acceptIncoming = async () => {
  if (accepting.value || accepted.value || !canAccept.value) return
  accepting.value = true
  error.value = null
  try {
    await $fetch(`/api/channels/${props.channelId}/ai/accept`, {
      method: 'POST',
      body: { proposal: props.proposal },
    })
    accepted.value = true
    await refreshItems()
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || 'Failed to accept tasks'
  } finally {
    accepting.value = false
  }
}
</script>

<template>
  <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[10px] uppercase tracking-wide text-slate-500">Task proposal</p>
        <p class="text-sm font-medium text-slate-900 truncate">
          {{ proposal.parentTitle }}
        </p>
        <p v-if="proposal.projectId" class="text-xs text-slate-500 mt-0.5">
          Project: {{ proposal.projectTitle || proposal.projectId }}
        </p>
        <p v-else class="text-xs text-amber-600 mt-0.5">
          Project needed before tasks can be created
        </p>
      </div>
      <button
        class="px-3 py-1.5 text-xs rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        :disabled="accepting || accepted || !canAccept"
        @click="acceptIncoming"
      >
        <span v-if="accepted">Accepted</span>
        <span v-else-if="accepting">Accepting...</span>
        <span v-else>Accept incoming</span>
      </button>
    </div>

    <div v-if="flatTasks.length > 0" class="mt-3 space-y-2">
      <div v-for="(task, index) in flatTasks" :key="`${task.title}-${index}`">
        <div class="flex items-start gap-2" :style="{ paddingLeft: `${task.depth * 14}px` }">
          <span class="text-slate-400">-</span>
          <div class="min-w-0">
            <p class="text-sm text-slate-800 truncate">
              {{ task.title }}
            </p>
            <p v-if="task.description" class="text-xs text-slate-500 mt-0.5">
              {{ task.description }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <p v-if="error" class="text-xs text-rose-600 mt-2">
      {{ error }}
    </p>
    <p v-else-if="accepted" class="text-xs text-emerald-600 mt-2">
      Tasks created
    </p>
  </div>
</template>
