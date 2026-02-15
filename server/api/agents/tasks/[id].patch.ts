import { prisma } from '../../../utils/prisma'
import { requireAgentUser, requireAssignedTask } from '../../../utils/agentApi'

const VALID_ITEM_STATUSES = new Set(['TODO', 'IN_PROGRESS', 'BLOCKED', 'PAUSED'])

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const body = await readBody(event)
  const { status, subStatus, progress } = body

  if ('agentMode' in body) {
    throw createError({ statusCode: 403, message: 'Only humans can change agentMode' })
  }

  if (status === undefined && subStatus === undefined && progress === undefined) {
    throw createError({ statusCode: 400, message: 'No updatable fields provided' })
  }

  const agent = requireAgentUser(event)
  const currentTask = await requireAssignedTask(agent.id, taskId)

  let nextStatus: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'PAUSED' | undefined
  if (status !== undefined) {
    const normalizedStatus = typeof status === 'string' ? status.toUpperCase() : ''
    if (normalizedStatus === 'DONE') {
      throw createError({ statusCode: 403, message: 'Agents cannot set task status to DONE' })
    }
    if (!VALID_ITEM_STATUSES.has(normalizedStatus)) {
      throw createError({ statusCode: 400, message: 'Invalid status value' })
    }
    nextStatus = normalizedStatus as 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'PAUSED'
  }

  let nextProgress: number | undefined
  if (progress !== undefined) {
    if (typeof progress !== 'number' || Number.isNaN(progress)) {
      throw createError({ statusCode: 400, message: 'progress must be a number' })
    }
    if (progress < 0 || progress > 100) {
      throw createError({ statusCode: 400, message: 'progress must be between 0 and 100' })
    }
    nextProgress = Math.round(progress)
  }

  let nextSubStatus: string | null | undefined
  if (subStatus !== undefined) {
    if (subStatus === null) {
      nextSubStatus = null
    } else if (typeof subStatus === 'string') {
      const trimmed = subStatus.trim()
      if (!trimmed.length) {
        throw createError({ statusCode: 400, message: 'subStatus cannot be empty' })
      }
      if (trimmed.length > 100) {
        throw createError({ statusCode: 400, message: 'subStatus must be 100 characters or fewer' })
      }
      nextSubStatus = trimmed
    } else {
      throw createError({ statusCode: 400, message: 'subStatus must be a string or null' })
    }
  }

  const now = new Date()
  const activities: Array<{ type: 'STATUS_CHANGE' | 'PROGRESS_UPDATE' | 'UPDATED'; oldValue?: string | null; newValue?: string | null }> = []

  if (nextStatus && nextStatus !== currentTask.status) {
    activities.push({
      type: 'STATUS_CHANGE',
      oldValue: currentTask.status,
      newValue: nextStatus,
    })
  }

  if (nextProgress !== undefined && nextProgress !== currentTask.progress) {
    activities.push({
      type: 'PROGRESS_UPDATE',
      oldValue: String(currentTask.progress),
      newValue: String(nextProgress),
    })
  }

  if (nextSubStatus !== undefined && nextSubStatus !== currentTask.subStatus) {
    activities.push({
      type: 'UPDATED',
      oldValue: currentTask.subStatus,
      newValue: nextSubStatus,
    })
  }

  const updatedTask = await prisma.$transaction(async (tx) => {
    const task = await tx.item.update({
      where: { id: taskId },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextSubStatus !== undefined ? { subStatus: nextSubStatus } : {}),
        ...(nextProgress !== undefined ? { progress: nextProgress } : {}),
        ...(
          nextStatus === 'IN_PROGRESS' &&
          currentTask.status !== 'IN_PROGRESS' &&
          currentTask.status !== 'DONE' &&
          !currentTask.startDate
            ? { startDate: now }
            : {}
        ),
        lastActivityAt: now,
      },
      select: {
        id: true,
        status: true,
        subStatus: true,
        progress: true,
        agentMode: true,
        updatedAt: true,
      },
    })

    if (activities.length) {
      await tx.activity.createMany({
        data: activities.map((activity) => ({
          itemId: taskId,
          userId: agent.id,
          type: activity.type,
          oldValue: activity.oldValue ?? null,
          newValue: activity.newValue ?? null,
        })),
      })
    }

    return task
  })

  return {
    id: updatedTask.id,
    status: updatedTask.status,
    subStatus: updatedTask.subStatus,
    progress: updatedTask.progress,
    agentMode: updatedTask.agentMode,
    updatedAt: updatedTask.updatedAt.toISOString(),
  }
})
