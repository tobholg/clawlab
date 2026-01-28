import type { Task, TaskStatus } from '~/types'

export const useTasks = (projectId?: string) => {
  const tasks = useState<Task[]>('tasks', () => [])
  const loading = useState('tasks-loading', () => false)
  const error = useState<string | null>('tasks-error', () => null)

  const fetchTasks = async () => {
    loading.value = true
    error.value = null
    try {
      const query = projectId ? `?projectId=${projectId}` : ''
      const response = await $fetch(`/api/tasks${query}`)
      tasks.value = response.tasks.map(transformTask)
    } catch (e: any) {
      error.value = e.data?.message || 'Failed to fetch tasks'
    } finally {
      loading.value = false
    }
  }

  const createTask = async (data: {
    projectId: string
    title: string
    description?: string
    scope?: string
    type?: string
    assigneeIds?: string[]
    tags?: string[]
  }) => {
    const response = await $fetch('/api/tasks', {
      method: 'POST',
      body: data
    })
    const newTask = transformTask(response.task)
    tasks.value = [newTask, ...tasks.value]
    return newTask
  }

  const updateTask = async (taskId: string, data: Partial<{
    title: string
    description: string
    status: TaskStatus
    scope: string
    progress: number
    confidence: string
    energy: string
    type: string
  }>) => {
    const response = await $fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: data
    })
    const updatedTask = transformTask(response.task)
    const index = tasks.value.findIndex(t => t.id === taskId)
    if (index !== -1) {
      tasks.value[index] = updatedTask
    }
    return updatedTask
  }

  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    return updateTask(taskId, { status: newStatus.toUpperCase().replace('-', '_') as any })
  }

  return {
    tasks: readonly(tasks),
    loading: readonly(loading),
    error: readonly(error),
    fetchTasks,
    createTask,
    updateTask,
    moveTask
  }
}

// Transform API response to match frontend types
function transformTask(apiTask: any): Task {
  return {
    id: apiTask.id,
    projectId: apiTask.projectId,
    title: apiTask.title,
    description: apiTask.description,
    assignees: apiTask.assignees || [],
    scope: apiTask.scope,
    progress: apiTask.progress,
    blocks: apiTask.blocks || [],
    blockedBy: apiTask.blockedBy || [],
    type: apiTask.type.toLowerCase().replace('_', '-'),
    tags: apiTask.tags || [],
    status: apiTask.status.toLowerCase().replace('_', '-') as TaskStatus,
    confidence: apiTask.confidence.toLowerCase(),
    energy: apiTask.energy.toLowerCase().replace('_', '-'),
    temperature: calculateTemperature(new Date(apiTask.lastActivityAt)),
    startedAt: apiTask.startedAt ? new Date(apiTask.startedAt) : undefined,
    createdAt: new Date(apiTask.createdAt),
    updatedAt: new Date(apiTask.updatedAt),
    lastActivityAt: new Date(apiTask.lastActivityAt),
    originalScope: apiTask.originalScope
  }
}

function calculateTemperature(lastActivityAt: Date): 'hot' | 'warm' | 'cold' | 'stale' {
  const now = new Date()
  const hoursSinceActivity = (now.getTime() - lastActivityAt.getTime()) / (1000 * 60 * 60)

  if (hoursSinceActivity < 24) return 'hot'
  if (hoursSinceActivity < 72) return 'warm'
  if (hoursSinceActivity < 168) return 'cold'
  return 'stale'
}
