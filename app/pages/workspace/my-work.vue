<script setup lang="ts">
import { getItemEstimateMeta } from '~/utils/itemRisk'

definePageMeta({ layout: 'workspace' })

const router = useRouter()
const { groups, totalCount, activeCount, loading, statusFilter, sortBy, fetchMyTasks } = useMyTasks()

// Local expanded state for project groups (all expanded by default)
const collapsedGroups = ref(new Set<string>())

const toggleGroup = (projectId: string) => {
  if (collapsedGroups.value.has(projectId)) {
    collapsedGroups.value.delete(projectId)
  } else {
    collapsedGroups.value.add(projectId)
  }
}

const isGroupExpanded = (projectId: string) => !collapsedGroups.value.has(projectId)

// Task detail modal
const showDetailModal = ref(false)
const selectedItem = ref<any>(null)

const openTask = (task: any) => {
  selectedItem.value = task
  showDetailModal.value = true
}

const handleUpdate = async (_id: string, opts?: { _close?: boolean }) => {
  if (opts?._close) {
    showDetailModal.value = false
  }
  await fetchMyTasks()
}

// Status helpers
const statusPillClass = (status: string) => {
  switch (status) {
    case 'DONE': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
    case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400'
    case 'BLOCKED': return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400'
    case 'PAUSED': return 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
    default: return 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400'
  }
}

const statusLabel = (status: string) => {
  switch (status) {
    case 'DONE': return 'Done'
    case 'IN_PROGRESS': return 'In Progress'
    case 'BLOCKED': return 'Blocked'
    case 'PAUSED': return 'Paused'
    default: return 'To Do'
  }
}

const tempDotClass = (temp: string) => {
  if (temp === 'critical') return 'bg-red-500'
  if (temp === 'hot') return 'bg-orange-400'
  return ''
}

const formatDate = (date: string | null) => {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const dueDateClass = (task: any) => {
  if (!task.dueDate) return ''
  const meta = getItemEstimateMeta(task)
  if (meta.missProb >= 66) return 'text-rose-500 dark:text-rose-400'
  if (meta.missProb >= 33) return 'text-amber-500 dark:text-amber-400'
  if (task.status === 'done' || task.status === 'DONE') return 'text-emerald-500 dark:text-emerald-400'
  // Has due date with low risk
  if (task.startDate && task.progress > 0) return 'text-emerald-500 dark:text-emerald-400'
  return 'text-slate-400 dark:text-zinc-500'
}
</script>

<template>
  <div class="flex-1 flex flex-col">
    <!-- Header -->
    <div class="px-8 pt-8 pb-4">
      <h1 class="text-2xl font-semibold text-slate-900 dark:text-zinc-100 mb-4">My Work</h1>

      <div class="flex items-center justify-between gap-4">
        <!-- Status filter tabs -->
        <div class="flex items-center gap-1 bg-slate-100 dark:bg-white/[0.08] rounded-lg p-0.5">
          <button
            v-for="opt in [
              { value: 'active', label: 'Active' },
              { value: 'done', label: 'Done' },
            ]"
            :key="opt.value"
            @click="statusFilter = opt.value as any"
            class="px-3 py-1.5 text-sm rounded-md transition-colors"
            :class="statusFilter === opt.value
              ? 'bg-white dark:bg-white/[0.08] text-slate-900 dark:text-zinc-100 shadow-sm font-medium'
              : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'"
          >
            {{ opt.label }}
            <span v-if="opt.value === 'active' && activeCount > 0" class="ml-1 text-xs text-slate-400 dark:text-zinc-500">{{ activeCount }}</span>
          </button>
        </div>

        <!-- Sort dropdown -->
        <select
          v-model="sortBy"
          class="text-sm border border-slate-200 dark:border-white/[0.06] rounded-lg px-3 py-1.5 text-slate-600 dark:text-zinc-300 bg-white dark:bg-dm-card focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-500/20"
        >
          <option value="updatedAt">Recently Updated</option>
          <option value="dueDate">Due Date</option>
          <option value="status">Status</option>
        </select>
      </div>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto px-8 pb-8">
      <!-- Loading -->
      <div v-if="loading && !groups.length" class="py-12 text-center text-slate-400 dark:text-zinc-500">
        Loading tasks...
      </div>

      <!-- Empty state -->
      <div v-else-if="!groups.length" class="py-16 text-center">
        <Icon name="heroicons:clipboard-document-check" class="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
        <p class="text-slate-500 dark:text-zinc-500">No tasks found</p>
        <p class="text-sm text-slate-400 dark:text-zinc-500 mt-1">Tasks assigned to you will appear here</p>
      </div>

      <!-- Project groups -->
      <div v-else class="space-y-4">
        <div
          v-for="group in groups"
          :key="group.project.id"
          class="bg-white dark:bg-dm-card rounded-xl border border-slate-200 dark:border-white/[0.06] overflow-hidden"
        >
          <!-- Project header -->
          <button
            @click="toggleGroup(group.project.id)"
            class="w-full flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <Icon
              :name="isGroupExpanded(group.project.id) ? 'heroicons:chevron-down' : 'heroicons:chevron-right'"
              class="w-4 h-4 text-slate-400 dark:text-zinc-500 flex-shrink-0"
            />
            <span class="font-medium text-slate-900 dark:text-zinc-100 flex-1 text-left">{{ group.project.title }}</span>
            <span class="text-xs text-slate-400 dark:text-zinc-500">{{ group.tasks.length }} task{{ group.tasks.length !== 1 ? 's' : '' }}</span>
            <NuxtLink
              v-if="group.project.id"
              :to="`/workspace/projects/${group.project.id}`"
              @click.stop
              class="p-1 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            >
              <Icon name="heroicons:arrow-top-right-on-square" class="w-3.5 h-3.5" />
            </NuxtLink>
          </button>

          <!-- Task rows -->
          <div v-if="isGroupExpanded(group.project.id)" class="border-t border-slate-100 dark:border-white/[0.06]">
            <button
              v-for="task in group.tasks"
              :key="task.id"
              @click="openTask(task)"
              class="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors border-b border-slate-50 dark:border-white/[0.04] last:border-b-0"
            >
              <!-- Status dot -->
              <div
                class="w-2 h-2 rounded-full flex-shrink-0"
                :class="{
                  'bg-slate-300 dark:bg-zinc-600': task.status === 'TODO',
                  'bg-blue-500': task.status === 'IN_PROGRESS',
                  'bg-red-500': task.status === 'BLOCKED',
                  'bg-amber-400': task.status === 'PAUSED',
                  'bg-emerald-500': task.status === 'DONE',
                }"
              />

              <!-- Title -->
              <span class="flex-1 text-left text-sm text-slate-800 dark:text-zinc-200 truncate">{{ task.title }}</span>

              <!-- Status pill -->
              <span
                class="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                :class="statusPillClass(task.status)"
              >
                {{ statusLabel(task.status) }}
              </span>

              <!-- Temperature dot -->
              <div
                v-if="tempDotClass(task.temperature)"
                class="w-2 h-2 rounded-full flex-shrink-0"
                :class="tempDotClass(task.temperature)"
              />

              <!-- Due date -->
              <span v-if="task.dueDate" class="text-xs font-medium flex-shrink-0" :class="dueDateClass(task)">
                {{ formatDate(task.dueDate) }}
              </span>

              <!-- Progress bar -->
              <div v-if="task.progress > 0" class="w-16 flex-shrink-0">
                <div class="h-1.5 bg-slate-100 dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="task.progress >= 100 ? 'bg-emerald-400' : 'bg-blue-400'"
                    :style="{ width: `${Math.min(task.progress, 100)}%` }"
                  />
                </div>
              </div>

              <!-- Blocked indicator -->
              <Icon
                v-if="task.isBlocked"
                name="heroicons:no-symbol"
                class="w-4 h-4 text-red-400 flex-shrink-0"
              />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Task Detail Modal -->
    <ItemsItemDetailModal
      :open="showDetailModal"
      :item="selectedItem"
      @close="showDetailModal = false"
      @update="handleUpdate"
      @view-full="(item: any) => { showDetailModal = false; router.push(`/workspace/projects/${item.id}`) }"
      @deleted="handleUpdate"
    />
  </div>
</template>
