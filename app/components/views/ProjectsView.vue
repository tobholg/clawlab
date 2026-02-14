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
  openDocs: [project: ItemNode]
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

// Owner tooltip state
const tooltipProjectId = ref<string | null>(null)
const tooltipPos = ref({ top: 0, left: 0 })
const ownerAvatarRefs = ref<Record<string, HTMLElement>>({})

const setOwnerRef = (projectId: string) => (el: any) => {
  if (el) ownerAvatarRefs.value[projectId] = el
}

const onOwnerEnter = (project: ItemNode) => {
  const el = ownerAvatarRefs.value[project.id]
  if (el) {
    const rect = el.getBoundingClientRect()
    tooltipPos.value = {
      top: rect.top,
      left: rect.left + rect.width / 2,
    }
  }
  tooltipProjectId.value = project.id
}

const onOwnerLeave = () => {
  tooltipProjectId.value = null
}

const tooltipProject = computed(() => {
  if (!tooltipProjectId.value) return null
  return props.projects.find(p => p.id === tooltipProjectId.value) ?? null
})

// Avatar colors (deterministic based on id)
const avatarColors = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-indigo-500',
]

const getAvatarColor = (id: string) => {
  const hash = (id || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return avatarColors[hash % avatarColors.length]
}

const getInitials = (name: string) => {
  return (name || '').split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}

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
      textClass: 'text-emerald-600 dark:text-emerald-400',
      barClass: 'from-emerald-500 via-emerald-400 to-emerald-200',
      trackClass: 'bg-emerald-50 dark:bg-emerald-500/10',
    }
  }

  if (score >= 85) {
    return { score, label: 'Excellent', textClass: 'text-emerald-600 dark:text-emerald-400', barClass: 'from-emerald-500 via-emerald-400 to-emerald-200', trackClass: 'bg-emerald-50 dark:bg-emerald-500/10' }
  }
  if (score >= 70) {
    return { score, label: 'Good', textClass: 'text-teal-600 dark:text-teal-400', barClass: 'from-teal-500 via-teal-400 to-teal-200', trackClass: 'bg-teal-50 dark:bg-teal-500/10' }
  }
  if (score >= 55) {
    return { score, label: 'Watch', textClass: 'text-amber-600 dark:text-amber-400', barClass: 'from-amber-500 via-amber-400 to-amber-200', trackClass: 'bg-amber-50 dark:bg-amber-500/10' }
  }
  return { score, label: 'Risk', textClass: 'text-rose-600 dark:text-rose-400', barClass: 'from-rose-500 via-rose-400 to-rose-200', trackClass: 'bg-rose-50 dark:bg-rose-500/10' }
}
</script>

<template>
  <div>
    <!-- Projects Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
      <div
        v-for="project in sortedProjects"
        :key="project.id"
        class="group relative overflow-hidden bg-white/90 dark:bg-dm-card/90 rounded-2xl border border-slate-100 dark:border-white/[0.06] shadow-[0_10px_30px_-20px_rgba(15,23,42,0.45)] dark:shadow-[0_10px_30px_-20px_rgba(0,0,0,0.6)] hover:bg-slate-50/80 hover:shadow-[0_18px_50px_-24px_rgba(15,23,42,0.55)] dark:hover:shadow-[0_18px_50px_-24px_rgba(0,0,0,0.7)] dark:hover:border-white/[0.1] dark:hover:bg-white/[0.07] transition-all duration-200 cursor-pointer"
        @click="emit('openProject', project)"
      >
        <div class="p-5 relative">
          <!-- Title -->
          <div class="flex items-start justify-between mb-3">
            <div class="min-w-0">
              <h3 class="text-[15px] font-semibold text-slate-800 dark:text-zinc-200 leading-snug group-hover:text-slate-900 dark:group-hover:text-zinc-100 transition-colors truncate">
                {{ project.title }}
              </h3>
            </div>
            <button
              @click.stop="emit('openDetail', project)"
              class="opacity-0 group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center text-slate-300 dark:text-zinc-600 hover:text-slate-500 dark:hover:text-zinc-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-all flex-shrink-0 ml-3 -mr-1 -mt-1"
            >
              <Icon name="heroicons:ellipsis-horizontal" class="w-4 h-4" />
            </button>
          </div>

          <!-- Project Health -->
          <div class="mb-4">
            <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 mb-1.5">
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
          <div class="mb-4 rounded-xl border border-slate-100 dark:border-white/[0.06] bg-white dark:bg-dm-card p-3">
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
          <div class="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400">
            <!-- Left: Owner -->
            <div class="flex items-center gap-2">
              <template v-if="project.owner">
                <div
                  :ref="setOwnerRef(project.id)"
                  class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 cursor-default"
                  :class="getAvatarColor(project.owner.id)"
                  @mouseenter="onOwnerEnter(project)"
                  @mouseleave="onOwnerLeave"
                >
                  <span class="text-[9px] text-white font-semibold">{{ getInitials(project.owner.name) }}</span>
                </div>
                <span class="text-slate-600 dark:text-zinc-300">{{ project.owner.name?.split(' ')[0] }}</span>
              </template>
              <span v-else class="text-slate-400 dark:text-zinc-500">No owner</span>
            </div>

            <!-- Right: Meta -->
            <div class="flex items-center gap-3">
              <span v-if="project.lastActivityAt || project.updatedAt">{{ formatRelativeTime(project.lastActivityAt || project.updatedAt) }}</span>
              <template v-if="(project.childrenCount ?? 0) > 0">
                <span v-if="hasAllChildrenCompleted(project)" class="text-emerald-600">All items completed</span>
                <span v-else class="text-slate-400">{{ getActiveChildrenCount(project) }} items</span>
              </template>
              <button
                v-if="project.totalDocumentCount"
                @click.stop="emit('openDocs', project)"
                class="flex items-center gap-1 text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <Icon name="heroicons:document-text" class="w-3 h-3" />
                {{ project.totalDocumentCount }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- New Project Card -->
      <button
        v-if="showCreateCard"
        @click="emit('createProject')"
        class="flex flex-col items-center justify-center min-h-[200px] bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-dm-card dark:via-dm-card/50 dark:to-dm-card rounded-2xl border border-dashed border-slate-300 dark:border-white/[0.08] hover:border-slate-400 dark:hover:border-white/[0.1] hover:shadow-sm transition-all group"
      >
        <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/[0.08] group-hover:bg-slate-300 dark:group-hover:bg-white/[0.08] flex items-center justify-center mb-2 transition-colors">
          <Icon name="heroicons:plus" class="w-5 h-5 text-slate-500 dark:text-zinc-400 group-hover:text-slate-600 dark:group-hover:text-zinc-300" />
        </div>
        <span class="text-sm text-slate-500 dark:text-zinc-400 group-hover:text-slate-600 dark:group-hover:text-zinc-300">New Project</span>
      </button>
    </div>

    <!-- Owner tooltip (teleported to avoid overflow clipping) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="tooltipProject?.owner"
          class="fixed z-[100] pointer-events-none"
          :style="{ top: `${tooltipPos.top - 8}px`, left: `${tooltipPos.left}px`, transform: 'translate(-50%, -100%)' }"
        >
          <div class="flex items-center gap-2.5 px-3 py-2.5 bg-white dark:bg-zinc-800 rounded-xl shadow-lg shadow-black/10 dark:shadow-black/50 border border-slate-200/80 dark:border-zinc-700 whitespace-nowrap">
            <div
              :class="[
                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                getAvatarColor(tooltipProject.owner.id)
              ]"
            >
              <span class="text-[10px] text-white font-semibold">{{ getInitials(tooltipProject.owner.name) }}</span>
            </div>
            <div class="min-w-0">
              <div class="text-[13px] font-medium text-slate-800 dark:text-zinc-100">{{ tooltipProject.owner.name }}</div>
              <div v-if="tooltipProject.owner.position" class="text-[11px] text-slate-500 dark:text-zinc-400">{{ tooltipProject.owner.position }}</div>
              <div v-else class="text-[11px] text-slate-500 dark:text-zinc-400">Owner</div>
            </div>
          </div>
          <div class="flex justify-center -mt-px">
            <div class="w-2 h-2 bg-white dark:bg-zinc-800 border-b border-r border-slate-200/80 dark:border-zinc-700 rotate-45 -translate-y-1"></div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
