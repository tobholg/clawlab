<script setup lang="ts">
import type { Task, TaskStatus } from '~/types'

const props = defineProps<{
  tasks: Task[]
}>()

const emit = defineEmits<{
  taskClick: [task: Task]
  taskMove: [taskId: string, newStatus: TaskStatus]
}>()

const columns: { id: TaskStatus; title: string }[] = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'in-progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
]

const tasksByStatus = computed(() => {
  const grouped: Record<TaskStatus, Task[]> = {
    'backlog': [],
    'todo': [],
    'in-progress': [],
    'review': [],
    'done': [],
  }

  props.tasks.forEach(task => {
    grouped[task.status].push(task)
  })

  return grouped
})

const getColumnCount = (status: TaskStatus) => tasksByStatus.value[status].length

// Drag and drop handling
const draggedTask = ref<Task | null>(null)

const onDragStart = (task: Task) => {
  draggedTask.value = task
}

const onDragOver = (e: DragEvent) => {
  e.preventDefault()
}

const onDrop = (status: TaskStatus) => {
  if (draggedTask.value && draggedTask.value.status !== status) {
    emit('taskMove', draggedTask.value.id, status)
  }
  draggedTask.value = null
}
</script>

<template>
  <div class="flex gap-4 overflow-x-auto pb-4">
    <div 
      v-for="column in columns" 
      :key="column.id"
      class="kanban-column"
      @dragover="onDragOver"
      @drop="onDrop(column.id)"
    >
      <!-- Column header -->
      <div class="kanban-column__header">
        <span>{{ column.title }}</span>
        <span class="kanban-column__count">
          {{ getColumnCount(column.id) }}
        </span>
      </div>

      <!-- Tasks -->
      <div class="space-y-3">
        <div
          v-for="task in tasksByStatus[column.id]"
          :key="task.id"
          draggable="true"
          @dragstart="onDragStart(task)"
          @click="emit('taskClick', task)"
        >
          <TasksTaskCard :task="task" />
        </div>

        <!-- Empty state -->
        <div 
          v-if="tasksByStatus[column.id].length === 0"
          class="text-center py-8 text-gray-400 text-sm"
        >
          No tasks
        </div>
      </div>
    </div>
  </div>
</template>
