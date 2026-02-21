import { prisma } from '../../utils/prisma'
import { requireAgentUser, requireAssignedTask } from '../../utils/agentApi'
import { broadcast } from '../../utils/websocket'

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

  const task = await requireAssignedTask(agent.id, taskId)
  const now = new Date()
  const projectId = task.projectId ?? task.parentId ?? task.id

  const session = await prisma.$transaction(async (tx) => {
    const activeSession = await tx.agentSession.findFirst({
      where: {
        agentId: agent.id,
        status: 'ACTIVE',
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (activeSession && activeSession.itemId === taskId) {
      return activeSession
    }

    // If there's an active session with a terminal, update it to point to the new task
    // rather than creating a new one (keeps the terminal link alive)
    if (activeSession?.terminalId) {
      return tx.agentSession.update({
        where: { id: activeSession.id },
        data: {
          itemId: taskId,
          projectId,
          checkedOutAt: now,
        },
      })
    }

    // Otherwise close the old session and create a new one
    if (activeSession) {
      await tx.agentSession.update({
        where: { id: activeSession.id },
        data: { status: 'IDLE' },
      })
    }

    return tx.agentSession.create({
      data: {
        agentId: agent.id,
        itemId: taskId,
        projectId,
        checkedOutAt: now,
        status: 'ACTIVE',
      },
    })
  })

  await prisma.item.update({
    where: { id: taskId },
    data: {
      ...(task.status !== 'IN_PROGRESS' ? { status: 'IN_PROGRESS' } : {}),
      ...(task.startDate ? {} : { startDate: now }),
      subStatus: 'executing',
      lastActivityAt: now,
    },
  })

  const updatedTask = await prisma.item.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      subStatus: true,
      progress: true,
      agentMode: true,
      parentId: true,
      projectId: true,
      planDoc: {
        select: {
          id: true,
          title: true,
        },
      },
      children: {
        select: {
          id: true,
          title: true,
          status: true,
          subStatus: true,
          progress: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!updatedTask) {
    throw createError({ statusCode: 404, message: 'Task not found' })
  }

  // Broadcast so terminal tabs can update their task title
  try {
    broadcast({
      type: 'agent_session_update',
      agentId: agent.id,
      sessionId: session.id,
      terminalId: session.terminalId,
      taskId: updatedTask.id,
      taskTitle: updatedTask.title,
      status: session.status,
    })
  } catch {
    // Non-critical — don't fail the checkout if broadcast fails
  }

  return {
    session: {
      id: session.id,
      agentId: session.agentId,
      itemId: session.itemId,
      projectId: session.projectId,
      terminalId: session.terminalId,
      status: session.status,
      checkedOutAt: toIso(session.checkedOutAt),
      completedAt: toIso(session.completedAt),
      createdAt: toIso(session.createdAt),
      updatedAt: toIso(session.updatedAt),
    },
    task: {
      id: updatedTask.id,
      title: updatedTask.title,
      description: updatedTask.description,
      status: updatedTask.status,
      subStatus: updatedTask.subStatus,
      progress: updatedTask.progress,
      agentMode: updatedTask.agentMode,
      planDoc: updatedTask.planDoc
        ? {
            id: updatedTask.planDoc.id,
            title: updatedTask.planDoc.title,
          }
        : null,
      subtasks: updatedTask.children.map((subtask) => ({
        id: subtask.id,
        title: subtask.title,
        status: subtask.status,
        subStatus: subtask.subStatus,
        progress: subtask.progress,
      })),
    },
  }
})
