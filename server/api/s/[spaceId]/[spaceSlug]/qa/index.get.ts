import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { requireUser } from '../../../../../utils/auth'

// Get all IRs in a space (Q&A view)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const spaceId = getRouterParam(event, 'spaceId')
  const spaceSlug = getRouterParam(event, 'spaceSlug')
  const query = getQuery(event)

  const sort = (query.sort as string) || 'recent'
  const search = (query.search as string) || ''
  const limit = parseInt(query.limit as string) || 50
  const offset = parseInt(query.offset as string) || 0

  if (!spaceId || !spaceSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Space ID and slug are required' })
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

  // Build where clause
  const where: any = {
    externalSpaceId: space.id
  }

  if (search) {
    where.content = {
      contains: search,
      mode: 'insensitive'
    }
  }

  // Get IRs with comments
  const irs = await prisma.informationRequest.findMany({
    where,
    include: {
      createdBy: {
        select: { id: true, name: true }
      },
      externalComments: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: {
            select: { id: true, name: true }
          }
        }
      }
    },
    orderBy: sort === 'votes' 
      ? undefined // We'll sort by votes manually since it's a JSON field
      : { createdAt: 'desc' },
    take: limit,
    skip: offset
  })

  // Get stakeholder access info for display names
  const stakeholderAccesses = await prisma.stakeholderAccess.findMany({
    where: {
      externalSpaceId: space.id,
      userId: { in: irs.map(ir => ir.createdById) }
    }
  })

  const accessMap = new Map(stakeholderAccesses.map(a => [a.userId, a]))

  // Transform and optionally sort by votes
  let result = irs.map(ir => {
    const creatorAccess = accessMap.get(ir.createdById)
    const votes = Array.isArray(ir.votes) ? ir.votes : JSON.parse(ir.votes as string || '[]')
    
    return {
      id: ir.id,
      type: ir.type.toLowerCase(),
      content: ir.content,
      status: ir.status.toLowerCase(),
      response: ir.response,
      votes: votes.length,
      hasVoted: votes.includes(user.id),
      createdBy: {
        displayName: creatorAccess?.displayName || ir.createdBy.name || 'Anonymous',
        position: creatorAccess?.position
      },
      comments: ir.externalComments.map(c => ({
        id: c.id,
        authorName: c.author.name || 'Unknown',
        content: c.content,
        isTeamMember: c.isTeamMember,
        createdAt: c.createdAt.toISOString()
      })),
      createdAt: ir.createdAt.toISOString()
    }
  })

  // Sort by votes if requested
  if (sort === 'votes') {
    result = result.sort((a, b) => b.votes - a.votes)
  }

  return result
})
