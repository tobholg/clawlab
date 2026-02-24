import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../../utils/prisma'
import { requireUser } from '../../../../utils/auth'
import { checkCanCreateExternalSpace } from '../../../../utils/planLimits'

function getDefaultMaxIrsPer24h() {
  const parsed = Number(process.env.RELAI_DEFAULT_MAX_IRS_PER_24H)
  if (!Number.isFinite(parsed) || parsed < 0) return 10
  return Math.floor(parsed)
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = getRouterParam(event, 'projectId')
  const body = await readBody<{
    name: string
    description?: string
    maxIRsPer24h?: number
    allowTaskSubmission?: boolean
  }>(event)

  if (!projectId) {
    throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
  }

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Name is required' })
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
    select: { id: true, workspaceId: true }
  })

  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  // Enforce plan limit
  const spaceCheck = await checkCanCreateExternalSpace(project.workspaceId)
  if (!spaceCheck.allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: `External space limit reached (${spaceCheck.current}/${spaceCheck.limit}). Adjust your configured limits to create more spaces.`,
    })
  }

  // Generate slug from name
  const baseSlug = body.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  // Check if slug exists and make unique if needed
  let slug = baseSlug
  let counter = 1
  while (await prisma.externalSpace.findFirst({ 
    where: { projectId, slug } 
  })) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  const space = await prisma.externalSpace.create({
    data: {
      projectId,
      name: body.name.trim(),
      slug,
      description: body.description?.trim() || null,
      maxIRsPer24h: body.maxIRsPer24h ?? getDefaultMaxIrsPer24h(),
      allowTaskSubmission: body.allowTaskSubmission ?? false
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
      stakeholderCount: 0,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString()
    }
  }
})
