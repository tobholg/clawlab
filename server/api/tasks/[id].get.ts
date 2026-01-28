import { defineEventHandler, createError, getRouterParam } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const taskId = getRouterParam(event, 'id')

  if (!taskId) {
    throw createError({ statusCode: 400, statusMessage: 'Task ID is required' })
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        include: {
          members: {
            where: { userId: user.id }
          }
        }
      },
      assignees: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true }
          }
        }
      },
      tags: {
        include: { tag: true }
      },
      blockedBy: {
        include: {
          blockingTask: {
            select: { id: true, title: true, status: true }
          }
        }
      },
      blocks: {
        include: {
          blockedTask: {
            select: { id: true, title: true, status: true }
          }
        }
      },
      activities: {
        include: {
          user: {
            select: { id: true, name: true, avatar: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50
      },
      comments: {
        include: {
          user: {
            select: { id: true, name: true, avatar: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'Task not found' })
  }

  if (task.project.members.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied' })
  }

  return {
    task: {
      ...task,
      assignees: task.assignees.map(a => a.user),
      tags: task.tags.map(t => t.tag.name),
      blockedBy: task.blockedBy.map(d => d.blockingTask),
      blocks: task.blocks.map(d => d.blockedTask)
    }
  }
})
