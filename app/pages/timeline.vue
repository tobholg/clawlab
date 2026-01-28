<script setup lang="ts">
import type { Task } from '~/types'

definePageMeta({
  title: 'Timeline',
  middleware: 'auth'
})

const { currentProject, fetchProjects } = useProjects()
const { tasks, fetchTasks } = useTasks()

onMounted(async () => {
  await fetchProjects()
  if (currentProject.value) {
    await fetchTasks()
  }
})

watch(currentProject, async () => {
  if (currentProject.value) {
    await fetchTasks()
  }
})

const handleTaskClick = (task: Task) => {
  console.log('Task clicked:', task)
  // TODO: Open task detail modal
}

// Stats
const stats = computed(() => {
  const active = tasks.value.filter(t => t.status !== 'done' && t.status !== 'backlog')
  const withProgress = active.filter(t => t.progress > 0)
  
  // Calculate average velocity
  const velocities = withProgress
    .filter(t => t.startedAt)
    .map(t => {
      const days = (Date.now() - new Date(t.startedAt!).getTime()) / (24 * 60 * 60 * 1000)
      return t.progress / Math.max(days, 1)
    })
  
  const avgVelocity = velocities.length > 0 
    ? velocities.reduce((a, b) => a + b, 0) / velocities.length 
    : 0
  
  return {
    activeTasks: active.length,
    withProgress: withProgress.length,
    avgVelocity: avgVelocity.toFixed(1),
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Timeline</h1>
        <p class="text-sm text-gray-500">Velocity-based projections for {{ currentProject?.name || 'all projects' }}</p>
      </div>
      
      <div class="flex items-center gap-4 text-sm">
        <div class="bg-white rounded-lg border border-gray-200 px-4 py-2">
          <span class="text-gray-500">Active:</span>
          <span class="font-semibold ml-1">{{ stats.activeTasks }}</span>
        </div>
        <div class="bg-white rounded-lg border border-gray-200 px-4 py-2">
          <span class="text-gray-500">Avg velocity:</span>
          <span class="font-semibold ml-1">{{ stats.avgVelocity }}%/day</span>
        </div>
      </div>
    </div>

    <!-- No project state -->
    <div v-if="!currentProject" class="bg-white rounded-xl p-12 border border-gray-200 text-center">
      <p class="text-gray-500">Select a project to view timeline.</p>
    </div>

    <!-- Timeline -->
    <TimelineTimelineView 
      v-else
      :tasks="tasks"
      @task-click="handleTaskClick"
    />

    <!-- Help text -->
    <div class="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
      <p class="font-medium mb-1">How timeline works:</p>
      <ul class="list-disc list-inside space-y-1 text-blue-700">
        <li>Bar length = estimated duration based on current velocity</li>
        <li>Fill = actual progress percentage</li>
        <li>Tasks without progress (0%) are not shown</li>
        <li>Estimated completion = (time elapsed) / (progress %) × 100%</li>
      </ul>
    </div>
  </div>
</template>
