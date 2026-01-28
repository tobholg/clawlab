<script setup lang="ts">
import type { Task } from '~/types'

definePageMeta({
  title: 'Dependencies',
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
  const withDeps = tasks.value.filter(t => t.blockedBy.length > 0 || t.blocks.length > 0)
  const blocked = tasks.value.filter(t => t.blockedBy.length > 0 && t.status !== 'done')
  const blocking = tasks.value.filter(t => t.blocks.length > 0 && t.status !== 'done')
  
  return {
    withDeps: withDeps.length,
    blocked: blocked.length,
    blocking: blocking.length,
  }
})

// Critical path: tasks that block the most other tasks
const criticalTasks = computed(() => 
  tasks.value
    .filter(t => t.blocks.length > 0 && t.status !== 'done')
    .sort((a, b) => b.blocks.length - a.blocks.length)
    .slice(0, 5)
)
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">Dependencies</h1>
        <p class="text-sm text-gray-500">What blocks what in {{ currentProject?.name || 'all projects' }}</p>
      </div>
      
      <div class="flex items-center gap-4 text-sm">
        <div class="bg-white rounded-lg border border-gray-200 px-4 py-2">
          <span class="text-gray-500">With deps:</span>
          <span class="font-semibold ml-1">{{ stats.withDeps }}</span>
        </div>
        <div class="bg-white rounded-lg border border-gray-200 px-4 py-2">
          <span class="text-gray-500">Blocked:</span>
          <span class="font-semibold ml-1 text-red-600">{{ stats.blocked }}</span>
        </div>
        <div class="bg-white rounded-lg border border-gray-200 px-4 py-2">
          <span class="text-gray-500">Blocking:</span>
          <span class="font-semibold ml-1 text-orange-600">{{ stats.blocking }}</span>
        </div>
      </div>
    </div>

    <!-- No project state -->
    <div v-if="!currentProject" class="bg-white rounded-xl p-12 border border-gray-200 text-center">
      <p class="text-gray-500">Select a project to view dependencies.</p>
    </div>

    <template v-else>
      <!-- Critical path warning -->
      <div 
        v-if="criticalTasks.length > 0"
        class="bg-orange-50 border border-orange-100 rounded-lg p-4"
      >
        <h3 class="text-sm font-semibold text-orange-800 mb-2">
          <Icon name="heroicons:exclamation-triangle" class="w-4 h-4 inline mr-1" />
          Critical Path Tasks
        </h3>
        <p class="text-sm text-orange-700 mb-3">
          These tasks are blocking the most other work. Prioritize completing them.
        </p>
        <div class="flex flex-wrap gap-2">
          <span 
            v-for="task in criticalTasks" 
            :key="task.id"
            class="inline-flex items-center gap-1 px-3 py-1 bg-white rounded-full text-sm border border-orange-200"
          >
            <span class="font-medium text-gray-900">{{ task.title }}</span>
            <span class="text-orange-600">(blocks {{ task.blocks.length }})</span>
          </span>
        </div>
      </div>

      <!-- Graph -->
      <DependenciesDependencyGraph 
        :tasks="tasks"
        @task-click="handleTaskClick"
      />

      <!-- Legend -->
      <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm">
        <h3 class="font-medium text-gray-700 mb-2">How to read the graph:</h3>
        <ul class="grid grid-cols-2 gap-2 text-gray-600">
          <li class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-gray-100 border-2 border-gray-300" />
            Backlog
          </li>
          <li class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-blue-50 border-2 border-blue-300" />
            To Do
          </li>
          <li class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-yellow-50 border-2 border-yellow-300" />
            In Progress
          </li>
          <li class="flex items-center gap-2">
            <div class="w-4 h-4 rounded bg-green-50 border-2 border-green-300" />
            Done
          </li>
          <li class="flex items-center gap-2 col-span-2">
            <svg width="40" height="10">
              <path d="M 0 5 L 30 5" stroke="#cbd5e1" stroke-width="2" fill="none" marker-end="url(#arrow)" />
              <marker id="arrow" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                <polygon points="0 0, 6 2, 0 4" fill="#cbd5e1" />
              </marker>
            </svg>
            Arrow = "blocks" (left task must complete before right task can start)
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
