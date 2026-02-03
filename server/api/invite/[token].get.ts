import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../utils/prisma'

// Public endpoint - no auth required
// This validates an invite token and returns space info for the signup flow

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token')

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token is required' })
  }

  // Decode the token
  let tokenData: {
    spaceId: string
    projectId: string
    createdBy: string
    createdAt: number
    random: string
  }

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    tokenData = JSON.parse(decoded)
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid invite token' })
  }

  // Validate token hasn't expired (7 days)
  const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days in ms
  if (Date.now() - tokenData.createdAt > maxAge) {
    throw createError({ statusCode: 400, statusMessage: 'Invite link has expired' })
  }

  // Verify space exists and is not archived
  const space = await prisma.externalSpace.findFirst({
    where: {
      id: tokenData.spaceId,
      projectId: tokenData.projectId,
      archived: false
    },
    include: {
      project: {
        select: { id: true, title: true, description: true }
      }
    }
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'This invite is no longer valid' })
  }

  return {
    valid: true,
    space: {
      id: space.id,
      name: space.name,
      slug: space.slug,
      description: space.description
    },
    project: {
      id: space.project.id,
      title: space.project.title,
      description: space.project.description
    }
  }
})
