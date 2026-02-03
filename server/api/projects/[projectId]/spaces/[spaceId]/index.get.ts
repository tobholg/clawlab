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

  // Get space with stakeholder details
  const space = await prisma.externalSpace.findFirst({
    where: {
      id: spaceId,
      projectId,
      archived: false
    },
    include: {
      stakeholderAccess: {
        include: {
          user: {
            select: { id: true, email: true, name: true, avatar: true }
          },
          inviter: {
            select: { id: true, name: true }
          }
        }
      },
      _count: {
        select: {
          informationRequests: true,
          externalTasks: true
        }
      }
    }
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Space not found' })
  }

  return {
    space: {
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      maxIRsPer24h: space.maxIRsPer24h,
      allowTaskSubmission: space.allowTaskSubmission,
      stakeholderCount: space.stakeholderAccess.length,
      informationRequestCount: space._count.informationRequests,
      externalTaskCount: space._count.externalTasks,
      stakeholders: space.stakeholderAccess.map(sa => ({
        id: sa.user.id,
        email: sa.user.email,
        name: sa.displayName || sa.user.name,
        avatar: sa.user.avatar,
        position: sa.position,
        canSubmitTasks: sa.canSubmitTasks ?? space.allowTaskSubmission,
        maxIRsPer24h: sa.maxIRsPer24h ?? space.maxIRsPer24h,
        invitedAt: sa.invitedAt.toISOString(),
        invitedBy: sa.inviter ? {
          id: sa.inviter.id,
          name: sa.inviter.name
        } : null
      })),
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString()
    }
  }
})
