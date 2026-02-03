import { defineEventHandler, getRouterParam, createError, readBody } from 'h3'
import { prisma } from '../../../../../../utils/prisma'
import { requireUser } from '../../../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = getRouterParam(event, 'projectId')
  const spaceId = getRouterParam(event, 'spaceId')
  const userId = getRouterParam(event, 'userId')

  if (!projectId || !spaceId || !userId) {
    throw createError({ statusCode: 400, statusMessage: 'Project ID, Space ID, and User ID are required' })
  }

  const body = await readBody<{
    canSubmitTasks?: boolean
    maxIRsPer24h?: number
  }>(event)

  // Verify user has access to this project
  const project = await prisma.item.findFirst({
    where: {
      id: projectId,
      parentId: null,
      workspace: {
        members: {
          some: { userId: user.id }
        }
      }
    },
    select: { id: true }
  })

  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  // Verify space exists
  const space = await prisma.externalSpace.findFirst({
    where: {
      id: spaceId,
      projectId,
      archived: false
    }
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Space not found' })
  }

  // Find the stakeholder access record
  const stakeholderAccess = await prisma.stakeholderAccess.findUnique({
    where: {
      userId_externalSpaceId: {
        userId,
        externalSpaceId: spaceId
      }
    }
  })

  if (!stakeholderAccess) {
    throw createError({ statusCode: 404, statusMessage: 'Stakeholder not found in this space' })
  }

  // Update the stakeholder access
  const updated = await prisma.stakeholderAccess.update({
    where: {
      userId_externalSpaceId: {
        userId,
        externalSpaceId: spaceId
      }
    },
    data: {
      ...(body.canSubmitTasks !== undefined && { canSubmitTasks: body.canSubmitTasks }),
      ...(body.maxIRsPer24h !== undefined && { maxIRsPer24h: body.maxIRsPer24h })
    },
    include: {
      user: {
        select: { id: true, email: true, name: true }
      }
    }
  })

  return {
    success: true,
    stakeholder: {
      id: updated.user.id,
      canSubmitTasks: updated.canSubmitTasks,
      maxIRsPer24h: updated.maxIRsPer24h
    }
  }
})
