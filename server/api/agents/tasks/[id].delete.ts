import { prisma } from '../../../utils/prisma'
import { requireTokenUser, requireAssignedTask } from '../../../utils/agentApi'
import { emitSubtaskDeleted } from '../../../utils/agentNotify'

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const agent = await requireTokenUser(event)
  const task = await requireAssignedTask(agent.id, taskId)

  if (task.ownerId !== agent.id) {
    throw createError({ statusCode: 403, message: 'Only the task owner can delete this task' })
  }

  if (task.parentId === null) {
    throw createError({ statusCode: 400, message: 'Agents cannot delete root projects from this endpoint' })
  }

  const taskTitle = task.title
  await prisma.item.delete({ where: { id: taskId } })

  // Emit notification (use parent as context since this task is being deleted)
  const taskCtx = { id: taskId, title: taskTitle, workspaceId: task.workspaceId, projectId: task.projectId }
  emitSubtaskDeleted(agent, taskCtx, taskTitle).catch(() => {})

  return { success: true }
})
