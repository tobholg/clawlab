import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../../../utils/prisma'
import { requireUser } from '../../../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = getRouterParam(event, 'projectId')
  const spaceId = getRouterParam(event, 'spaceId')
  const stakeholderUserId = getRouterParam(event, 'userId')

  if (!projectId || !spaceId || !stakeholderUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Project ID, Space ID, and User ID are required' })
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
  const space = await prisma.externalSpace.findFirst({
    where: {
      id: spaceId,
      projectId,
      archived: false
    },
    select: { id: true }
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Space not found' })
  }

  // Find and remove the stakeholder access
  const stakeholderAccess = await prisma.stakeholderAccess.findFirst({
    where: {
      userId: stakeholderUserId,
      externalSpaceId: spaceId
    }
  })

  if (!stakeholderAccess) {
    throw createError({ statusCode: 404, statusMessage: 'Stakeholder not found in this space' })
  }

  // Delete the stakeholder access (their IRs and tasks remain for continuity)
  await prisma.stakeholderAccess.delete({
    where: { id: stakeholderAccess.id }
  })

  return { success: true }
})
