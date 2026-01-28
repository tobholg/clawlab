import { defineEventHandler, readBody, createError } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

type CreateTaskInput = {
  projectId: string
  title: string
  description?: string
  scope?: 'XS' | 'S' | 'M' | 'L' | 'XL'
  type?: 'FEATURE' | 'BUG' | 'TECH_DEBT' | 'EXPLORATION' | 'SUPPORT'
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH'
  energy?: 'AUTOPILOT' | 'MODERATE' | 'DEEP_FOCUS'
  assigneeIds?: string[]
  tags?: string[]
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody<CreateTaskInput>(event)

  if (!body.projectId || !body.title?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Project ID and title are required' })
  }

  // Verify user has access to project
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: body.projectId,
        userId: user.id
      }
    }
  })

  if (!membership) {
    throw createError({ statusCode: 403, statusMessage: 'Access denied to this project' })
  }

  // Create or get tags
  const tagConnections = body.tags?.length
    ? await Promise.all(
        body.tags.map(async (tagName) => {
          const tag = await prisma.tag.upsert({
            where: { name: tagName.toLowerCase() },
            create: { name: tagName.toLowerCase() },
            update: {}
          })
          return { tagId: tag.id }
        })
      )
    : []

  const task = await prisma.task.create({
    data: {
      projectId: body.projectId,
      title: body.title.trim(),
      description: body.description?.trim(),
      scope: body.scope || 'M',
      type: body.type || 'FEATURE',
      confidence: body.confidence || 'MEDIUM',
      energy: body.energy || 'MODERATE',
      originalScope: body.scope || 'M',
      assignees: body.assigneeIds?.length
        ? {
            create: body.assigneeIds.map(userId => ({ userId }))
          }
        : undefined,
      tags: tagConnections.length
        ? {
            create: tagConnections
          }
        : undefined,
      activities: {
        create: {
          userId: user.id,
          type: 'CREATED'
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
