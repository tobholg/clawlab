import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { requireUser } from '../../../../../utils/auth'

// Add a comment to an information request (stakeholder only - must be their own IR)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const spaceSlug = getRouterParam(event, 'spaceSlug')
  const irId = getRouterParam(event, 'irId')

  if (!spaceSlug || !irId) {
    throw createError({ statusCode: 400, statusMessage: 'Space slug and IR ID are required' })
  }

  const body = await readBody<{ content: string }>(event)
  
  if (!body.content?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Comment content is required' })
  }

  // Find space
  const space = await prisma.externalSpace.findFirst({
    where: {
      slug: spaceSlug,
      archived: false
    }
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Portal not found' })
  }

  // Verify user has stakeholder access
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

  // Find the IR and verify it belongs to this user
  const ir = await prisma.informationRequest.findFirst({
    where: {
      id: irId,
      externalSpaceId: space.id,
      createdById: user.id
    }
  })

  if (!ir) {
    throw createError({ statusCode: 404, statusMessage: 'Information request not found' })
  }

  // Create the comment
  const comment = await prisma.externalComment.create({
    data: {
      informationRequestId: irId,
      authorId: user.id,
      content: body.content.trim(),
      isTeamMember: false
    },
    include: {
      author: {
        select: { id: true, name: true }
      }
    }
  })

  return {
    comment: {
      id: comment.id,
      authorName: access.displayName || comment.author.name || 'Unknown',
      content: comment.content,
      isTeamMember: false,
      createdAt: comment.createdAt.toISOString()
    }
  }
})
