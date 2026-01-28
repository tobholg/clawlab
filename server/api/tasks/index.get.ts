import { defineEventHandler, getQuery } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const projectId = query.projectId as string | undefined

  const tasks = await prisma.task.findMany({
    where: {
      ...(projectId && { projectId }),
      project: {
        members: {
          some: { userId: user.id }
        }
      }
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
        include: {
          tag: true
        }
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
      }
    },
    orderBy: { lastActivityAt: 'desc' }
  })

  // Transform to match frontend types
  const transformed = tasks.map(task => ({
    ...task,
    assignees: task.assignees.map(a => a.user),
    tags: task.tags.map(t => t.tag.name),
    blockedBy: task.blockedBy.map(d => d.blockingTask.id),
    blocks: task.blocks.map(d => d.blockedTask.id)
  }))

  return { tasks: transformed }
})
