import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { requireUser } from '../../../../utils/auth'

interface RequestBody {
  type: 'question' | 'suggestion'
  content: string
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const spaceId = getRouterParam(event, 'spaceId')
  const spaceSlug = getRouterParam(event, 'spaceSlug')

  if (!spaceId || !spaceSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Space ID and slug are required' })
  }

  const body = await readBody<RequestBody>(event)

  if (!body.content?.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Content is required',
    })
  }

  if (!['question', 'suggestion'].includes(body.type)) {
    throw createError({
      statusCode: 400,
      message: 'Type must be "question" or "suggestion"',
    })
  }

  // Find space and verify user has access
  const space = await prisma.externalSpace.findFirst({
    where: {
      id: spaceId,
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

  // Check rate limit (IRs in last 24 hours)
  const maxIRsPer24h = access.maxIRsPer24h ?? space.maxIRsPer24h
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  
  const recentIRCount = await prisma.informationRequest.count({
    where: {
      externalSpaceId: space.id,
      createdById: user.id,
      createdAt: { gte: twentyFourHoursAgo }
    }
  })

  if (recentIRCount >= maxIRsPer24h) {
    throw createError({
      statusCode: 429,
      message: `You've reached your limit of ${maxIRsPer24h} requests per 24 hours. Please try again later.`,
    })
  }

  // Create the Information Request
  const ir = await prisma.informationRequest.create({
    data: {
      externalSpaceId: space.id,
      createdById: user.id,
      type: body.type.toUpperCase() as 'QUESTION' | 'SUGGESTION',
      content: body.content.trim(),
      status: 'PENDING'
    }
  })

  return {
    id: ir.id,
    type: ir.type.toLowerCase(),
    content: ir.content,
    status: ir.status.toLowerCase(),
    createdAt: ir.createdAt.toISOString()
  }
})
