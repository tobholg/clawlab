import { prisma } from '../../../utils/prisma'
import { requireTokenUser, requireAssignedTask } from '../../../utils/agentApi'
import { getDefaultSubStatus } from '../../../utils/itemStage'
import { emitStatusChange, emitProgressUpdate, emitSubStatusChange, emitFieldUpdate } from '../../../utils/agentNotify'

const MAX_TITLE_LENGTH = 255
const MAX_DESCRIPTION_LENGTH = 10000
const VALID_ITEM_STATUSES = new Set(['TODO', 'IN_PROGRESS', 'BLOCKED', 'PAUSED'])
const VALID_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const body = await readBody(event)
  const { status, subStatus, progress, title, description, category, priority, repoPath, defaultBranch, repoUrl } = body

  if ('agentMode' in body) {
    throw createError({ statusCode: 403, message: 'Only humans can change agentMode' })
  }

  const includesSubtaskOnlyFields =
    title !== undefined || description !== undefined || category !== undefined || priority !== undefined
  const includesRepoFields =
    repoPath !== undefined || defaultBranch !== undefined || repoUrl !== undefined

  if (
    status === undefined &&
    subStatus === undefined &&
    progress === undefined &&
    !includesSubtaskOnlyFields &&
    !includesRepoFields
  ) {
    throw createError({ statusCode: 400, message: 'No updatable fields provided' })
  }

  const agent = await requireTokenUser(event)
  const currentTask = await requireAssignedTask(agent.id, taskId)
  const isAgentOwnedSubtask =
    currentTask.ownerId === agent.id &&
    currentTask.parentId !== null &&
    currentTask.parentId !== currentTask.projectId

  if (includesSubtaskOnlyFields && !isAgentOwnedSubtask) {
    throw createError({
      statusCode: 403,
      message: 'Top-level tasks can only update status, subStatus, and progress',
    })
  }

  let nextSubStatus: string | null | undefined
  let nextStatus: 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'PAUSED' | 'DONE' | undefined
  let nextProgress: number | undefined

  if (status !== undefined) {
    let normalizedStatus = typeof status === 'string' ? status.toUpperCase() : ''
    if (normalizedStatus === 'DONE') {
      if (isAgentOwnedSubtask) {
        // Agent-owned subtasks: allow DONE directly
      } else {
        // Human-assigned tasks: agent can't set DONE, move to IN_PROGRESS/review instead
        normalizedStatus = 'IN_PROGRESS'
        nextSubStatus = 'review'
        nextProgress = 90
      }
    } else if (!VALID_ITEM_STATUSES.has(normalizedStatus)) {
      throw createError({ statusCode: 400, message: 'Invalid status value' })
    }
    nextStatus = normalizedStatus as 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'PAUSED' | 'DONE'
  }
  if (progress !== undefined) {
    if (typeof progress !== 'number' || Number.isNaN(progress)) {
      throw createError({ statusCode: 400, message: 'progress must be a number' })
    }
    if (progress < 0 || progress > 100) {
      throw createError({ statusCode: 400, message: 'progress must be between 0 and 100' })
    }
    nextProgress = Math.round(progress)
  }

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

  let nextTitle: string | undefined
  if (title !== undefined) {
    if (typeof title !== 'string') {
      throw createError({ statusCode: 400, message: 'title must be a string' })
    }
    const trimmed = title.trim()
    if (!trimmed.length) {
      throw createError({ statusCode: 400, message: 'title is required' })
    }
    if (trimmed.length > MAX_TITLE_LENGTH) {
      throw createError({ statusCode: 400, message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` })
    }
    nextTitle = trimmed
  }

  let nextDescription: string | null | undefined
  if (description !== undefined) {
    if (description === null) {
      nextDescription = null
    } else if (typeof description === 'string') {
      const trimmed = description.trim()
      if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
        throw createError({ statusCode: 400, message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` })
      }
      nextDescription = trimmed.length ? trimmed : null
    } else {
      throw createError({ statusCode: 400, message: 'description must be a string or null' })
    }
  }

  let nextCategory: string | null | undefined
  if (category !== undefined) {
    if (category === null) {
      nextCategory = null
    } else if (typeof category === 'string') {
      const trimmed = category.trim()
      nextCategory = trimmed.length ? trimmed : null
    } else {
      throw createError({ statusCode: 400, message: 'category must be a string or null' })
    }
  }

  let nextPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null | undefined
  if (priority !== undefined) {
    if (priority === null) {
      nextPriority = null
    } else if (typeof priority === 'string') {
      const normalizedPriority = priority.toUpperCase()
      if (!VALID_PRIORITIES.has(normalizedPriority)) {
        throw createError({ statusCode: 400, message: 'Invalid priority value' })
      }
      nextPriority = normalizedPriority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    } else {
      throw createError({ statusCode: 400, message: 'priority must be a string or null' })
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

  if (nextTitle !== undefined && nextTitle !== currentTask.title) {
    activities.push({
      type: 'UPDATED',
      oldValue: currentTask.title,
      newValue: nextTitle,
    })
  }

  if (nextDescription !== undefined && nextDescription !== currentTask.description) {
    activities.push({
      type: 'UPDATED',
      oldValue: currentTask.description,
      newValue: nextDescription,
    })
  }

  if (nextCategory !== undefined && nextCategory !== currentTask.category) {
    activities.push({
      type: 'UPDATED',
      oldValue: currentTask.category,
      newValue: nextCategory,
    })
  }

  if (nextPriority !== undefined && nextPriority !== currentTask.priority) {
    activities.push({
      type: 'UPDATED',
      oldValue: currentTask.priority,
      newValue: nextPriority,
    })
  }

  // Auto-set subStatus when status changes and no explicit subStatus was provided
  if (nextStatus && nextStatus !== currentTask.status && nextSubStatus === undefined) {
    if (nextStatus === 'DONE') {
      nextSubStatus = null
    } else {
      nextSubStatus = getDefaultSubStatus(nextStatus as 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'PAUSED')
    }
  }

  // Set completedAt when moving to DONE
  const completedAtUpdate = nextStatus === 'DONE' && currentTask.status !== 'DONE'
    ? { completedAt: now }
    : nextStatus && nextStatus !== 'DONE' && currentTask.status === 'DONE'
      ? { completedAt: null }
      : {}

  const updatedTask = await prisma.$transaction(async (tx) => {
    const task = await tx.item.update({
      where: { id: taskId },
      data: {
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextSubStatus !== undefined ? { subStatus: nextSubStatus } : {}),
        ...completedAtUpdate,
        ...(nextProgress !== undefined ? { progress: nextProgress } : {}),
        ...(nextTitle !== undefined ? { title: nextTitle } : {}),
        ...(nextDescription !== undefined ? { description: nextDescription } : {}),
        ...(nextCategory !== undefined ? { category: nextCategory } : {}),
        ...(nextPriority !== undefined ? { priority: nextPriority } : {}),
        ...(repoPath !== undefined ? { repoPath: repoPath || null } : {}),
        ...(defaultBranch !== undefined ? { defaultBranch: defaultBranch || null } : {}),
        ...(repoUrl !== undefined ? { repoUrl: repoUrl || null } : {}),
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
        title: true,
        description: true,
        category: true,
        priority: true,
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

  // Emit real-time notifications for changes
  const taskCtx = { id: taskId, title: updatedTask.title, workspaceId: currentTask.workspaceId, projectId: currentTask.projectId }

  if (nextStatus && nextStatus !== currentTask.status) {
    emitStatusChange(agent, taskCtx, currentTask.status, nextStatus).catch(() => {})
  }
  if (nextProgress !== undefined && nextProgress !== currentTask.progress) {
    emitProgressUpdate(agent, taskCtx, currentTask.progress, nextProgress).catch(() => {})
  }
  if (nextSubStatus !== undefined && nextSubStatus !== currentTask.subStatus) {
    emitSubStatusChange(agent, taskCtx, currentTask.subStatus, nextSubStatus ?? null).catch(() => {})
  }
  if (nextTitle !== undefined && nextTitle !== currentTask.title) {
    emitFieldUpdate(agent, taskCtx, 'Title', currentTask.title, nextTitle).catch(() => {})
  }
  if (nextCategory !== undefined && nextCategory !== currentTask.category) {
    emitFieldUpdate(agent, taskCtx, 'Category', currentTask.category, nextCategory ?? null).catch(() => {})
  }
  if (nextPriority !== undefined && nextPriority !== currentTask.priority) {
    emitFieldUpdate(agent, taskCtx, 'Priority', currentTask.priority, nextPriority ?? null).catch(() => {})
  }

  return {
    id: updatedTask.id,
    title: updatedTask.title,
    description: updatedTask.description,
    category: updatedTask.category,
    priority: updatedTask.priority,
    status: updatedTask.status,
    subStatus: updatedTask.subStatus,
    progress: updatedTask.progress,
    agentMode: updatedTask.agentMode,
    updatedAt: updatedTask.updatedAt.toISOString(),
  }
})
