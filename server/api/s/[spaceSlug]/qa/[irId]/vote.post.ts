import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../../../utils/prisma'
import { requireUser } from '../../../../../utils/auth'

// Toggle vote on an IR
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const spaceSlug = getRouterParam(event, 'spaceSlug')
  const irId = getRouterParam(event, 'irId')

  if (!spaceSlug || !irId) {
    throw createError({ statusCode: 400, statusMessage: 'Space slug and IR ID are required' })
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

  // Find the IR
  const ir = await prisma.informationRequest.findFirst({
    where: {
      id: irId,
      externalSpaceId: space.id
    }
  })

  if (!ir) {
    throw createError({ statusCode: 404, statusMessage: 'Request not found' })
  }

  // Parse existing votes
  const votes: string[] = Array.isArray(ir.votes) ? ir.votes : JSON.parse(ir.votes as string || '[]')
  const hasVoted = votes.includes(user.id)

  // Toggle vote
  let newVotes: string[]
  if (hasVoted) {
    newVotes = votes.filter(v => v !== user.id)
  } else {
    newVotes = [...votes, user.id]
  }

  // Update IR
  await prisma.informationRequest.update({
    where: { id: irId },
    data: { votes: newVotes }
  })

  return {
    voted: !hasVoted,
    voteCount: newVotes.length
  }
})
