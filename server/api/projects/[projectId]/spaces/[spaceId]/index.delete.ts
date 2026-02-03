import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { requireUser } from '../../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = getRouterParam(event, 'projectId')
  const spaceId = getRouterParam(event, 'spaceId')

  if (!projectId || !spaceId) {
    throw createError({ statusCode: 400, statusMessage: 'Project ID and Space ID are required' })
  }

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

  // Verify space exists and belongs to project
  const existingSpace = await prisma.externalSpace.findFirst({
    where: {
      id: spaceId,
      projectId,
      archived: false
    }
  })

  if (!existingSpace) {
    throw createError({ statusCode: 404, statusMessage: 'Space not found' })
  }

  // Soft delete by archiving
  await prisma.externalSpace.update({
    where: { id: spaceId },
    data: { archived: true }
  })

  return { success: true }
})
