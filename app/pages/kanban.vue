<script setup lang="ts">
import type { Task, TaskStatus } from '~/types'

definePageMeta({
  title: 'Kanban Board',
  middleware: 'auth'
})

const { currentProject, fetchProjects } = useProjects()
const { tasks, fetchTasks, createTask, moveTask } = useTasks()

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

const handleTaskMove = async (taskId: string, newStatus: TaskStatus) => {
  try {
    await moveTask(taskId, newStatus)
  } catch (e) {
    console.error('Failed to move task:', e)
  }
}

// New task modal
const showNewTask = ref(false)
const newTask = ref({
  title: '',
  description: '',
  scope: 'M' as const,
  type: 'FEATURE' as const,
})

const handleCreateTask = async () => {
  if (!newTask.value.title.trim() || !currentProject.value) return
  
  try {
    await createTask({
      projectId: currentProject.value.id,
      title: newTask.value.title,
      description: newTask.value.description,
      scope: newTask.value.scope,
      type: newTask.value.type,
    })
    showNewTask.value = false
    newTask.value = { title: '', description: '', scope: 'M', type: 'FEATURE' }
  } catch (e) {
    console.error('Failed to create task:', e)
  }
}

// View controls
const showFilters = ref(false)
</script>

<template>
  <div class="space-y-4">
    <!-- Controls -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <button 
          class="px-3 py-1.5 text-sm rounded-lg border transition-colors"
          :class="showFilters ? 'bg-clawlab-50 border-clawlab-200 text-clawlab-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'"
          @click="showFilters = !showFilters"
        >
          <Icon name="heroicons:funnel" class="w-4 h-4 inline mr-1" />
          Filters
        </button>
      </div>

      <button 
        @click="showNewTask = true"
        class="flex items-center gap-2 px-4 py-2 bg-clawlab-600 text-white text-sm rounded-lg hover:bg-clawlab-700 transition-colors"
        :disabled="!currentProject"
      >
        <Icon name="heroicons:plus" class="w-4 h-4" />
        Add Task
      </button>
    </div>

    <!-- No project selected -->
    <div v-if="!currentProject" class="bg-white rounded-xl p-12 border border-gray-200 text-center">
      <p class="text-gray-500">Select a project to view tasks.</p>
    </div>

    <!-- Kanban board -->
    <KanbanKanbanBoard 
      v-else
      :tasks="tasks"
      @task-click="handleTaskClick"
      @task-move="handleTaskMove"
    />

    <!-- New Task Modal -->
    <div 
      v-if="showNewTask" 
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="showNewTask = false"
    >
      <div class="bg-white rounded-2xl p-6 w-full max-w-lg">
        <h2 class="text-lg font-semibold mb-4">New Task</h2>
        
        <div class="space-y-4">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">Title</label>
            <input
              v-model="newTask.title"
              type="text"
              placeholder="What needs to be done?"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-clawlab-400 focus:ring-2 focus:ring-clawlab-100 outline-none"
            />
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">Description</label>
            <textarea
              v-model="newTask.description"
              placeholder="Optional details..."
              rows="3"
              class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-clawlab-400 focus:ring-2 focus:ring-clawlab-100 outline-none resize-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">Scope</label>
              <select
                v-model="newTask.scope"
                class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-clawlab-400 outline-none"
              >
                <option value="XS">XS - Extra Small</option>
                <option value="S">S - Small</option>
                <option value="M">M - Medium</option>
                <option value="L">L - Large</option>
                <option value="XL">XL - Extra Large</option>
              </select>
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wider text-gray-400 block mb-2">Type</label>
              <select
                v-model="newTask.type"
                class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-clawlab-400 outline-none"
              >
                <option value="FEATURE">Feature</option>
                <option value="BUG">Bug</option>
                <option value="TECH_DEBT">Tech Debt</option>
                <option value="EXPLORATION">Exploration</option>
                <option value="SUPPORT">Support</option>
              </select>
            </div>
          </div>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <button 
            @click="showNewTask = false"
            class="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button 
            @click="handleCreateTask"
            class="px-4 py-2 bg-clawlab-600 text-white rounded-lg hover:bg-clawlab-700"
          >
            Create Task
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
