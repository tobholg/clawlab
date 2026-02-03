import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../../../utils/prisma'
import { requireUser } from '../../../../../../utils/auth'

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
  const space = await prisma.externalSpace.findFirst({
    where: {
      id: spaceId,
      projectId,
      archived: false
    },
    select: {
      id: true,
      maxIRsPer24h: true,
      allowTaskSubmission: true
    }
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Space not found' })
  }

  // Get all stakeholders with their activity stats
  const stakeholders = await prisma.stakeholderAccess.findMany({
    where: {
      externalSpaceId: spaceId
    },
    include: {
      user: {
        select: { id: true, email: true, name: true, avatar: true }
      },
      inviter: {
        select: { id: true, name: true }
      }
    },
    orderBy: { invitedAt: 'desc' }
  })

  // Get IR and task counts per stakeholder
  const stakeholderIds = stakeholders.map(s => s.userId)
  
  const irCounts = await prisma.informationRequest.groupBy({
    by: ['createdById'],
    where: {
      externalSpaceId: spaceId,
      createdById: { in: stakeholderIds }
    },
    _count: true
  })

  const taskCounts = await prisma.externalTask.groupBy({
    by: ['submittedById'],
    where: {
      externalSpaceId: spaceId,
      submittedById: { in: stakeholderIds }
    },
    _count: true
  })

  const irCountMap = new Map(irCounts.map(c => [c.createdById, c._count]))
  const taskCountMap = new Map(taskCounts.map(c => [c.submittedById, c._count]))

  return {
    stakeholders: stakeholders.map(sa => ({
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
      } : null,
      stats: {
        informationRequests: irCountMap.get(sa.userId) || 0,
        externalTasks: taskCountMap.get(sa.userId) || 0
      }
    }))
  }
})
