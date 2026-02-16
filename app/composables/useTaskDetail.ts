// Global event bus for opening task detail modals from anywhere (e.g. toast notifications)
const listeners = new Set<(taskId: string, projectId: string) => void>()

export function useTaskDetail() {
  // Called by pages to register their modal opener
  function onOpenTask(handler: (taskId: string, projectId: string) => void) {
    listeners.add(handler)
    onUnmounted(() => listeners.delete(handler))
  }

  // Called by toasts/other components to request opening a task
  function openTask(taskId: string, projectId: string) {
    for (const handler of listeners) {
      handler(taskId, projectId)
    }
  }

  return { onOpenTask, openTask }
}
