import { prisma } from '../../utils/prisma'
import { requireAgentUser, requireAssignedTask } from '../../utils/agentApi'

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

export default defineEventHandler(async (event) => {
  const agent = requireAgentUser(event)
  const body = await readBody(event)
  const taskId = typeof body.taskId === 'string' ? body.taskId.trim() : ''

  if (!taskId) {
    throw createError({ statusCode: 400, message: 'taskId is required' })
  }

  await requireAssignedTask(agent.id, taskId)

  const now = new Date()
  const session = await prisma.agentSession.findFirst({
    where: {
      agentId: agent.id,
      itemId: taskId,
      status: 'ACTIVE',
    },
    orderBy: { checkedOutAt: 'desc' },
  })

  if (!session) {
    throw createError({ statusCode: 404, message: 'No active session found for this task' })
  }

  const [updatedSession, updatedTask] = await prisma.$transaction([
    prisma.agentSession.update({
      where: { id: session.id },
      data: {
        completedAt: now,
        status: 'AWAITING_REVIEW',
      },
    }),
    prisma.item.update({
      where: { id: taskId },
      data: {
        status: 'IN_PROGRESS',
        subStatus: 'review',
        progress: 90,
        agentMode: 'COMPLETED',
        lastActivityAt: now,
      },
      select: {
        id: true,
        title: true,
        progress: true,
        agentMode: true,
        status: true,
        subStatus: true,
      },
    }),
  ])

  const durationMs = updatedSession.checkedOutAt
    ? Math.max(0, now.getTime() - updatedSession.checkedOutAt.getTime())
    : null

  return {
    session: {
      id: updatedSession.id,
      agentId: updatedSession.agentId,
      itemId: updatedSession.itemId,
      projectId: updatedSession.projectId,
      terminalId: updatedSession.terminalId,
      status: updatedSession.status,
      checkedOutAt: toIso(updatedSession.checkedOutAt),
      completedAt: toIso(updatedSession.completedAt),
      createdAt: toIso(updatedSession.createdAt),
      updatedAt: toIso(updatedSession.updatedAt),
      durationMs,
    },
    task: {
      id: updatedTask.id,
      title: updatedTask.title,
      progress: updatedTask.progress,
      agentMode: updatedTask.agentMode,
      status: updatedTask.status,
      subStatus: updatedTask.subStatus,
    },
  }
})
