import { defineEventHandler, readBody, createError, getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

type UpdateTaskInput = {
  title?: string
  description?: string
  status?: 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
  scope?: 'XS' | 'S' | 'M' | 'L' | 'XL'
  progress?: number
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH'
  energy?: 'AUTOPILOT' | 'MODERATE' | 'DEEP_FOCUS'
  type?: 'FEATURE' | 'BUG' | 'TECH_DEBT' | 'EXPLORATION' | 'SUPPORT'
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const taskId = getRouterParam(event, 'id')
  const body = await readBody<UpdateTaskInput>(event)

  if (!taskId) {
    throw createError({ statusCode: 400, statusMessage: 'Task ID is required' })
  }

  // Get existing task and verify access
  const existingTask = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          members: {
            where: { userId: user.id }
          }
        }
      }
    }
  })

  if (!existingTask) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  if (existingTask.project.members.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  // Track activities
  const activities: { type: string; oldValue?: string; newValue?: string }[] = []

  if (body.status && body.status !== existingTask.status) {
    activities.push({
      type: 'STATUS_CHANGE',
      oldValue: existingTask.status,
      newValue: body.status
    })
  }

  if (body.progress !== undefined && body.progress !== existingTask.progress) {
    activities.push({
      type: 'PROGRESS_UPDATE',
      oldValue: String(existingTask.progress),
      newValue: String(body.progress)
    })
  }

  if (body.scope && body.scope !== existingTask.scope) {
    activities.push({
      type: 'SCOPE_CHANGE',
      oldValue: existingTask.scope,
      newValue: body.scope
    })
  }

  // Determine if we should set startedAt
  const shouldSetStartedAt = 
    body.status === 'IN_PROGRESS' && 
    existingTask.status !== 'IN_PROGRESS' && 
    !existingTask.startedAt

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...(body.title && { title: body.title.trim() }),
      ...(body.description !== undefined && { description: body.description?.trim() }),
      ...(body.status && { status: body.status }),
      ...(body.scope && { scope: body.scope }),
      ...(body.progress !== undefined && { progress: Math.min(100, Math.max(0, body.progress)) }),
      ...(body.confidence && { confidence: body.confidence }),
      ...(body.energy && { energy: body.energy }),
      ...(body.type && { type: body.type }),
      ...(shouldSetStartedAt && { startedAt: new Date() }),
      lastActivityAt: new Date(),
      activities: activities.length > 0
        ? {
            create: activities.map(a => ({
              userId: user.id,
              type: a.type as any,
              oldValue: a.oldValue,
              newValue: a.newValue
            }))
          }
        : undefined
    },
    include: {
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true }
          }
        }
      },
      tags: {
        include: { tag: true }
      }
    }
  })

  return {
    task: {
      ...task,
      assignees: task.assignees.map(a => a.user),
      tags: task.tags.map(t => t.tag.name)
    }
  }
})
