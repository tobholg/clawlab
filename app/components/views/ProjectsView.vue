<script setup lang="ts">
import type { ItemNode } from '~/types'

const props = defineProps<{
  projects: ItemNode[]
}>()

const emit = defineEmits<{
  openProject: [project: ItemNode]
  openDetail: [project: ItemNode]
  createProject: []
}>()

// Sort projects: those needing attention first, then by progress
const sortedProjects = computed(() => {
  return [...props.projects].sort((a, b) => {
    // Blocked projects first
    if (a.status === 'blocked' && b.status !== 'blocked') return -1
    if (b.status === 'blocked' && a.status !== 'blocked') return 1

    // Then projects with blocked children
    const aBlocked = a.blockedChildrenCount ?? 0
    const bBlocked = b.blockedChildrenCount ?? 0
    if (aBlocked > 0 && bBlocked === 0) return -1
    if (bBlocked > 0 && aBlocked === 0) return 1

    // Then projects with at-risk children
    const aRisk = a.atRiskChildrenCount ?? 0
    const bRisk = b.atRiskChildrenCount ?? 0
    if (aRisk > 0 && bRisk === 0) return -1
    if (bRisk > 0 && aRisk === 0) return 1

    // Done projects last
    if (a.status === 'done' && b.status !== 'done') return 1
    if (b.status === 'done' && a.status !== 'done') return -1

    // Then by due date (earliest first)
    const dueA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
    const dueB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
    return dueA - dueB
  })
})

// Format relative time for last activity
const formatRelativeTime = (dateStr: string | null | undefined) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div>
    <!-- Projects Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="project in sortedProjects"
        :key="project.id"
        class="group bg-white rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-200 cursor-pointer"
        :class="{ 'opacity-60': project.status === 'done' }"
        @click="emit('openProject', project)"
      >
        <div class="p-5">
          <!-- Title -->
          <div class="flex items-start justify-between mb-4">
            <h3 class="text-[15px] font-medium text-slate-800 leading-snug group-hover:text-slate-900 transition-colors">
              {{ project.title }}
            </h3>
            <button
              @click.stop="emit('openDetail', project)"
              class="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-all flex-shrink-0 ml-3 -mr-1 -mt-1"
            >
              <Icon name="heroicons:ellipsis-horizontal" class="w-4 h-4" />
            </button>
          </div>

          <!-- Heatmap (central focus) -->
          <div class="mb-4">
            <UiCompletionHeatmap :item-id="project.id" :days="14" />
          </div>

          <!-- Status row -->
          <div class="flex items-center gap-3 mb-3 text-xs">
            <template v-if="(project.blockedChildrenCount ?? 0) > 0 || (project.atRiskChildrenCount ?? 0) > 0">
              <span v-if="(project.blockedChildrenCount ?? 0) > 0" class="text-rose-500">
                {{ project.blockedChildrenCount }} blocked
              </span>
              <span v-if="(project.atRiskChildrenCount ?? 0) > 0" class="text-amber-500">
                {{ project.atRiskChildrenCount }} at risk
              </span>
            </template>
            <span v-else-if="project.status !== 'done' && project.status !== 'todo'" class="text-emerald-500">
              healthy
            </span>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between text-xs text-slate-400">
            <!-- Left: Owner -->
            <div class="flex items-center gap-2">
              <template v-if="project.owner">
                <div
                  class="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center"
                  :title="project.owner.name"
                >
                  <span class="text-[9px] text-slate-500 font-medium">{{ project.owner.name?.[0] ?? '?' }}</span>
                </div>
                <span class="text-slate-500">{{ project.owner.name?.split(' ')[0] }}</span>
              </template>
              <span v-else class="text-slate-300">No owner</span>
            </div>

            <!-- Right: Meta -->
            <div class="flex items-center gap-3">
              <span v-if="project.lastActivityAt || project.updatedAt">{{ formatRelativeTime(project.lastActivityAt || project.updatedAt) }}</span>
              <span v-if="project.childrenCount" class="text-slate-300">{{ project.childrenCount }} items</span>
            </div>
          </div>
        </div>
      </div>

      <!-- New Project Card -->
      <button
        @click="emit('createProject')"
        class="flex flex-col items-center justify-center min-h-[180px] bg-slate-50/50 rounded-xl border border-dashed border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group"
      >
        <div class="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center mb-2 transition-colors">
          <Icon name="heroicons:plus" class="w-5 h-5 text-slate-400 group-hover:text-slate-500" />
        </div>
        <span class="text-sm text-slate-400 group-hover:text-slate-500">New Project</span>
      </button>
    </div>
  </div>
</template>
