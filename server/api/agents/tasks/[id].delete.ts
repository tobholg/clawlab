import { prisma } from '../../../utils/prisma'
import { requireAgentUser, requireAssignedTask } from '../../../utils/agentApi'

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const agent = requireAgentUser(event)
  const task = await requireAssignedTask(agent.id, taskId)

  if (task.ownerId !== agent.id) {
    throw createError({ statusCode: 403, message: 'Only the task owner can delete this task' })
  }

  if (task.parentId === null) {
    throw createError({ statusCode: 400, message: 'Agents cannot delete root projects from this endpoint' })
  }

  await prisma.item.delete({ where: { id: taskId } })

  return { success: true }
})
