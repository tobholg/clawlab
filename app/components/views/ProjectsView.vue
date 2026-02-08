<script setup lang="ts">
import type { ItemNode } from '~/types'

const props = withDefaults(defineProps<{
  projects: ItemNode[]
  showCreateCard?: boolean
}>(), {
  showCreateCard: true,
})

const emit = defineEmits<{
  openProject: [project: ItemNode]
  openDetail: [project: ItemNode]
  createProject: []
  openAttention: [project: ItemNode, mode: 'at-risk' | 'blocked']
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

const getActiveChildrenCount = (project: ItemNode) => {
  if (typeof project.activeChildrenCount === 'number') return project.activeChildrenCount
  return project.childrenCount ?? 0
}

const hasAllChildrenCompleted = (project: ItemNode) => {
  return (project.childrenCount ?? 0) > 0 && getActiveChildrenCount(project) === 0
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const calculateHealthScore = (project: ItemNode) => {
  if (project.status === 'done') return 100

  let score = 100
  const blocked = project.blockedChildrenCount ?? 0
  const atRisk = project.atRiskChildrenCount ?? 0

  score -= Math.min(45, blocked * 12)
  score -= Math.min(30, atRisk * 6)

  if (project.status === 'blocked') score -= 18
  if (project.status === 'paused') score -= 10

  const activitySource = project.lastActivityAt || project.updatedAt || project.createdAt
  if (activitySource) {
    const last = new Date(activitySource).getTime()
    const days = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24))
    if (days > 21) score -= 15
    else if (days > 10) score -= 8
    else if (days > 5) score -= 4
  }

  if ((project.childrenCount ?? 0) > 0 && getActiveChildrenCount(project) === 0) {
    score += 5
  }

  return clamp(Math.round(score), 0, 100)
}

const healthMeta = (project: ItemNode) => {
  const score = calculateHealthScore(project)

  if (project.status === 'done') {
    return {
      score,
      label: 'Complete',
      textClass: 'text-emerald-600',
      barClass: 'from-emerald-500 via-emerald-400 to-emerald-200',
      trackClass: 'bg-emerald-50',
    }
  }

  if (score >= 85) {
    return { score, label: 'Excellent', textClass: 'text-emerald-600', barClass: 'from-emerald-500 via-emerald-400 to-emerald-200', trackClass: 'bg-emerald-50' }
  }
  if (score >= 70) {
    return { score, label: 'Good', textClass: 'text-teal-600', barClass: 'from-teal-500 via-teal-400 to-teal-200', trackClass: 'bg-teal-50' }
  }
  if (score >= 55) {
    return { score, label: 'Watch', textClass: 'text-amber-600', barClass: 'from-amber-500 via-amber-400 to-amber-200', trackClass: 'bg-amber-50' }
  }
  return { score, label: 'Risk', textClass: 'text-rose-600', barClass: 'from-rose-500 via-rose-400 to-rose-200', trackClass: 'bg-rose-50' }
}
</script>

<template>
  <div>
    <!-- Projects Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="project in sortedProjects"
        :key="project.id"
        class="group relative overflow-hidden bg-white/90 rounded-2xl border border-slate-100 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.45)] hover:shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
        @click="emit('openProject', project)"
      >
        <div class="p-5 relative">
          <!-- Title -->
          <div class="flex items-start justify-between mb-3">
            <div class="min-w-0">
              <h3 class="text-[15px] font-semibold text-slate-800 leading-snug group-hover:text-slate-900 transition-colors truncate">
                {{ project.title }}
              </h3>
            </div>
            <button
              @click.stop="emit('openDetail', project)"
              class="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-slate-500 hover:bg-slate-50 transition-all flex-shrink-0 ml-3 -mr-1 -mt-1"
            >
              <Icon name="heroicons:ellipsis-horizontal" class="w-4 h-4" />
            </button>
          </div>

          <!-- Project Health -->
          <div class="mb-4">
            <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
              <span>Project health</span>
              <span class="font-semibold" :class="healthMeta(project).textClass">
                {{ healthMeta(project).score }}% · {{ healthMeta(project).label }}
              </span>
            </div>
            <div class="h-2.5 rounded-full overflow-hidden" :class="healthMeta(project).trackClass">
              <div
                class="h-full rounded-full bg-gradient-to-r transition-all"
                :class="healthMeta(project).barClass"
                :style="{ width: `${healthMeta(project).score}%` }"
              />
            </div>
          </div>

          <!-- Heatmap (central focus) -->
          <div class="mb-4 rounded-xl border border-slate-100 bg-white p-3">
            <UiCompletionHeatmap :item-id="project.id" :days="14" />
          </div>

          <!-- Status row -->
          <div class="flex flex-wrap items-center gap-3 mb-3 text-xs">
            <template v-if="(project.blockedChildrenCount ?? 0) > 0 || (project.atRiskChildrenCount ?? 0) > 0">
              <button
                v-if="(project.blockedChildrenCount ?? 0) > 0"
                class="text-rose-500 hover:text-rose-600 transition-colors"
                @click.stop="emit('openAttention', project, 'blocked')"
              >
                {{ project.blockedChildrenCount }} blocked
              </button>
              <button
                v-if="(project.atRiskChildrenCount ?? 0) > 0"
                class="text-amber-500 hover:text-amber-600 transition-colors"
                @click.stop="emit('openAttention', project, 'at-risk')"
              >
                {{ project.atRiskChildrenCount }} at risk
              </button>
            </template>
            <span v-else-if="project.status !== 'done' && project.status !== 'todo'" class="text-emerald-500">
              healthy
            </span>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-between text-xs text-slate-500">
            <!-- Left: Owner -->
            <div class="flex items-center gap-2">
              <template v-if="project.owner">
                <div
                  class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center border border-slate-100"
                  :title="project.owner.name"
                >
                  <span class="text-[10px] text-slate-500 font-medium">{{ project.owner.name?.[0] ?? '?' }}</span>
                </div>
                <span class="text-slate-600">{{ project.owner.name?.split(' ')[0] }}</span>
              </template>
              <span v-else class="text-slate-400">No owner</span>
            </div>

            <!-- Right: Meta -->
            <div class="flex items-center gap-3">
              <span v-if="project.lastActivityAt || project.updatedAt">{{ formatRelativeTime(project.lastActivityAt || project.updatedAt) }}</span>
              <template v-if="(project.childrenCount ?? 0) > 0">
                <span v-if="hasAllChildrenCompleted(project)" class="text-emerald-600">All items completed</span>
                <span v-else class="text-slate-400">{{ getActiveChildrenCount(project) }} items</span>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- New Project Card -->
      <button
        v-if="showCreateCard"
        @click="emit('createProject')"
        class="flex flex-col items-center justify-center min-h-[200px] bg-gradient-to-br from-slate-50 via-white to-slate-50 rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 hover:shadow-sm transition-all group"
      >
        <div class="w-10 h-10 rounded-full bg-slate-200 group-hover:bg-slate-300 flex items-center justify-center mb-2 transition-colors">
          <Icon name="heroicons:plus" class="w-5 h-5 text-slate-500 group-hover:text-slate-600" />
        </div>
        <span class="text-sm text-slate-500 group-hover:text-slate-600">New Project</span>
      </button>
    </div>
  </div>
</template>
