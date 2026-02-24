import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/auth'
import { checkCanAddStakeholder } from '../../../utils/planLimits'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const token = getRouterParam(event, 'token')
  const body = await readBody<{
    displayName?: string
    position?: string
  }>(event)

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
        select: { id: true, title: true }
      }
    }
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'This invite is no longer valid' })
  }

  // Check if user already has access to this space
  const existingAccess = await prisma.stakeholderAccess.findUnique({
    where: {
      userId_externalSpaceId: {
        userId: user.id,
        externalSpaceId: space.id
      }
    }
  })

  if (existingAccess) {
    // User already has access, just redirect them
    return {
      ok: true,
      alreadyMember: true,
      space: {
        id: space.id,
        name: space.name,
        slug: space.slug
      },
      project: {
        id: space.project.id,
        title: space.project.title
      }
    }
  }

  // Check if user is already in another space for this project
  const otherAccess = await prisma.stakeholderAccess.findFirst({
    where: {
      userId: user.id,
      externalSpace: {
        projectId: tokenData.projectId
      }
    },
    include: {
      externalSpace: true
    }
  })

  if (otherAccess) {
    throw createError({
      statusCode: 400,
      statusMessage: `You're already a stakeholder in the "${otherAccess.externalSpace.name}" space for this project. Users can only be in one space per project.`
    })
  }

  // Enforce plan limit for external seats
  const project = await prisma.item.findUniqueOrThrow({
    where: { id: tokenData.projectId },
    select: { workspaceId: true, workspace: { select: { organizationId: true } } },
  })
  const stakeholderCheck = await checkCanAddStakeholder(project.workspace.organizationId)
  if (!stakeholderCheck.allowed) {
    throw createError({
      statusCode: 403,
      statusMessage: `External seat limit reached (${stakeholderCheck.current}/${stakeholderCheck.limit}). Ask the workspace owner to adjust configured limits.`,
    })
  }

  // Create stakeholder access
  await prisma.stakeholderAccess.create({
    data: {
      userId: user.id,
      externalSpaceId: space.id,
      invitedBy: tokenData.createdBy,
      displayName: body.displayName || null,
      position: body.position || null,
      // Default to no task submission - owner must enable per stakeholder
      canSubmitTasks: false,
      maxIRsPer24h: null
    }
  })

  return {
    ok: true,
    alreadyMember: false,
    space: {
      id: space.id,
      name: space.name,
      slug: space.slug
    },
    project: {
      id: space.project.id,
      title: space.project.title
    }
  }
})
