<script setup lang="ts">
import type { Task, Temperature } from '~/types'
import { calculateTemperature, calculateEstimatedCompletion } from '~/types'

const props = defineProps<{
  task: Task
}>()

const temperature = computed(() => calculateTemperature(props.task.lastActivityAt))
const metrics = computed(() => calculateEstimatedCompletion(props.task))

const energyIcons: Record<string, string> = {
  'autopilot': '☕',
  'moderate': '⚡',
  'deep-focus': '🎯',
}

const confidenceColors: Record<string, string> = {
  'low': 'text-red-500',
  'medium': 'text-yellow-500',
  'high': 'text-green-500',
}

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
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return avatarColors[hash % avatarColors.length]
}

const getInitials = (name: string) => {
  return name.split(' ').map(n => n?.[0] || '').join('').toUpperCase().slice(0, 2) || '?'
}
</script>

<template>
  <div 
    class="task-card cursor-pointer"
    :class="`task-card--${temperature}`"
  >
    <!-- Header: Title + Type -->
    <div class="flex items-start justify-between mb-2">
      <h3 class="font-medium text-gray-900 text-sm leading-tight">
        {{ task.title }}
      </h3>
      <span class="text-xs text-gray-400 uppercase">
        {{ task.type.replace('-', ' ') }}
      </span>
    </div>

    <!-- Tags -->
    <div v-if="task.tags.length" class="flex flex-wrap gap-1 mb-3">
      <span 
        v-for="tag in task.tags" 
        :key="tag"
        class="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded"
      >
        {{ tag }}
      </span>
    </div>

    <!-- Metrics row -->
    <div class="flex items-center gap-3 mb-3">
      <!-- Progress ring -->
      <UiProgressRing :progress="task.progress" :size="32" :stroke-width="3" />

      <!-- Scope badge -->
      <UiScopeBadge :scope="task.scope" />

      <!-- Energy indicator -->
      <span :title="`Energy: ${task.energy}`" class="text-sm">
        {{ energyIcons[task.energy] }}
      </span>

      <!-- Confidence indicator -->
      <span 
        :class="confidenceColors[task.confidence]"
        :title="`Confidence: ${task.confidence}`"
        class="text-xs font-medium"
      >
        {{ task.confidence === 'high' ? '●●●' : task.confidence === 'medium' ? '●●○' : '●○○' }}
      </span>
    </div>

    <!-- Assignees + Estimated completion -->
    <div class="flex items-center justify-between">
      <div class="flex -space-x-1.5">
        <div 
          v-for="assignee in task.assignees.slice(0, 3)" 
          :key="assignee.id"
          :class="[
            'w-6 h-6 rounded-full border-2 border-white flex items-center justify-center',
            getAvatarColor(assignee.id)
          ]"
          :title="assignee.name"
        >
          <span class="text-[10px] text-white font-medium">
            {{ getInitials(assignee.name) }}
          </span>
        </div>
        <div 
          v-if="task.assignees.length > 3"
          class="w-6 h-6 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center"
        >
          <span class="text-[10px] text-slate-600 font-medium">+{{ task.assignees.length - 3 }}</span>
        </div>
      </div>

      <!-- Estimated completion -->
      <span 
        v-if="task.progress > 0 && task.progress < 100"
        class="text-xs text-gray-500"
        :title="`Est. ${metrics.estimatedDaysRemaining.toFixed(1)} days remaining`"
      >
        ~{{ Math.ceil(metrics.estimatedDaysRemaining) }}d
      </span>
    </div>

    <!-- Warnings -->
    <div v-if="metrics.isStuck || metrics.scopeCreepDetected" class="mt-2 pt-2 border-t border-gray-100">
      <span v-if="metrics.isStuck" class="text-xs text-red-500 flex items-center gap-1">
        <Icon name="heroicons:exclamation-triangle" class="w-3 h-3" />
        Stuck
      </span>
      <span v-if="metrics.scopeCreepDetected" class="text-xs text-orange-500 flex items-center gap-1">
        <Icon name="heroicons:arrow-trending-up" class="w-3 h-3" />
        Scope creep
      </span>
    </div>

    <!-- Blocked indicator -->
    <div v-if="task.blockedBy.length > 0" class="mt-2 pt-2 border-t border-gray-100">
      <span class="text-xs text-gray-500 flex items-center gap-1">
        <Icon name="heroicons:lock-closed" class="w-3 h-3" />
        Blocked by {{ task.blockedBy.length }} task{{ task.blockedBy.length > 1 ? 's' : '' }}
      </span>
    </div>
  </div>
</template>
