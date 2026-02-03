import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { requireUser } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = getRouterParam(event, 'projectId')

  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
  }

  // Verify user has access to this project (is a member of the workspace)
  const project = await prisma.item.findFirst({
    where: {
      id: projectId,
      parentId: null, // Root item = project
      workspace: {
        members: {
          some: { userId: user.id }
        }
      }
    },
    select: { id: true, workspaceId: true }
  })

  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  // Get all spaces for this project with stakeholder counts
  const spaces = await prisma.externalSpace.findMany({
    where: {
      projectId,
      archived: false
    },
    include: {
      _count: {
        select: { stakeholderAccess: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return {
    spaces: spaces.map(space => ({
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      maxIRsPer24h: space.maxIRsPer24h,
      allowTaskSubmission: space.allowTaskSubmission,
      stakeholderCount: space._count.stakeholderAccess,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString()
    }))
  }
})
