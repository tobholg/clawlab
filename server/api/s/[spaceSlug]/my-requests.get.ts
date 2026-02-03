import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/auth'

// Get user's own requests (tasks and IRs) for a space
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const spaceSlug = getRouterParam(event, 'spaceSlug')

  if (!spaceSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Space slug is required' })
  }

  // Find space and verify user has access
  const space = await prisma.externalSpace.findFirst({
    where: {
      slug: spaceSlug,
      archived: false
    }
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Portal not found' })
  }

  // Check if user has stakeholder access
  const access = await prisma.stakeholderAccess.findUnique({
    where: {
      userId_externalSpaceId: {
        userId: user.id,
        externalSpaceId: space.id
      }
    }
  })

  if (!access) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to this portal' })
  }

  // Get user's external tasks with comments
  const tasks = await prisma.externalTask.findMany({
    where: {
      externalSpaceId: space.id,
      submittedById: user.id
    },
    include: {
      externalComments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: { id: true, name: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  // Get user's information requests with comments
  const irs = await prisma.informationRequest.findMany({
    where: {
      externalSpaceId: space.id,
      createdById: user.id
    },
    include: {
      externalComments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: { id: true, name: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return {
    tasks: tasks.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status.toLowerCase(),
      rejectionReason: task.rejectionReason,
      linkedTaskId: task.linkedTaskId,
      comments: task.externalComments.map(c => ({
        id: c.id,
        authorName: c.author.name || 'Unknown',
        content: c.content,
        isTeamMember: c.isTeamMember,
        createdAt: c.createdAt.toISOString()
      })),
      createdAt: task.createdAt.toISOString()
    })),
    irs: irs.map(ir => ({
      id: ir.id,
      type: ir.type.toLowerCase(),
      content: ir.content,
      status: ir.status.toLowerCase(),
      response: ir.response,
      comments: ir.externalComments.map(c => ({
        id: c.id,
        authorName: c.author.name || 'Unknown',
        content: c.content,
        isTeamMember: c.isTeamMember,
        createdAt: c.createdAt.toISOString()
      })),
      createdAt: ir.createdAt.toISOString()
    }))
  }
})
