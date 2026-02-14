import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { requireUser } from '../../../../utils/auth'

interface RequestBody {
  title: string
  description: string
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const spaceId = getRouterParam(event, 'spaceId')
  const spaceSlug = getRouterParam(event, 'spaceSlug')

  if (!spaceId || !spaceSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Space ID and slug are required' })
  }

  const body = await readBody<RequestBody>(event)

  if (!body.title?.trim()) {
    throw createError({
      statusCode: 400,
      message: 'Title is required',
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

  // Check if user has permission to submit tasks
  const canSubmitTasks = access.canSubmitTasks ?? space.allowTaskSubmission

  if (!canSubmitTasks) {
    throw createError({
      statusCode: 403,
      message: 'You do not have permission to submit tasks in this portal. You can submit a suggestion instead.',
    })
  }

  // Create the External Task
  const task = await prisma.externalTask.create({
    data: {
      externalSpaceId: space.id,
      submittedById: user.id,
      title: body.title.trim(),
      description: body.description?.trim() || '',
      status: 'PENDING'
    }
  })

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status.toLowerCase(),
    createdAt: task.createdAt.toISOString()
  }
})
