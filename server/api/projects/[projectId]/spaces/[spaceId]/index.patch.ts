import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { requireUser } from '../../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = getRouterParam(event, 'projectId')
  const spaceId = getRouterParam(event, 'spaceId')
  const body = await readBody<{
    name?: string
    description?: string
    maxIRsPer24h?: number
    allowTaskSubmission?: boolean
  }>(event)

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

  // Build update data
  const updateData: any = {}
  
  if (body.name !== undefined) {
    if (!body.name.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'Name cannot be empty' })
    }
    updateData.name = body.name.trim()
    
    // Update slug if name changed
    const newSlug = body.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    
    // Check if new slug conflicts with another space
    const conflicting = await prisma.externalSpace.findFirst({
      where: {
        projectId,
        slug: newSlug,
        id: { not: spaceId }
      }
    })
    
    if (conflicting) {
      // Add suffix to make unique
      let counter = 1
      let uniqueSlug = newSlug
      while (await prisma.externalSpace.findFirst({
        where: { projectId, slug: uniqueSlug, id: { not: spaceId } }
      })) {
        uniqueSlug = `${newSlug}-${counter}`
        counter++
      }
      updateData.slug = uniqueSlug
    } else {
      updateData.slug = newSlug
    }
  }

  if (body.description !== undefined) {
    updateData.description = body.description?.trim() || null
  }

  if (body.maxIRsPer24h !== undefined) {
    if (body.maxIRsPer24h < 0) {
      throw createError({ statusCode: 400, statusMessage: 'maxIRsPer24h must be non-negative' })
    }
    updateData.maxIRsPer24h = body.maxIRsPer24h
  }

  if (body.allowTaskSubmission !== undefined) {
    updateData.allowTaskSubmission = body.allowTaskSubmission
  }

  const space = await prisma.externalSpace.update({
    where: { id: spaceId },
    data: updateData,
    include: {
      _count: {
        select: { stakeholderAccess: true }
      }
    }
  })

  return {
    space: {
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description,
      maxIRsPer24h: space.maxIRsPer24h,
      allowTaskSubmission: space.allowTaskSubmission,
      stakeholderCount: space._count.stakeholderAccess,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString()
    }
  }
})
