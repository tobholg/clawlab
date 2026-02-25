import { prisma } from '../../utils/prisma'
import { requireTokenUser } from '../../utils/agentApi'

const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 5000

export default defineEventHandler(async (event) => {
  const agent = await requireTokenUser(event)
  const body = await readBody(event)

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) {
    throw createError({ statusCode: 400, message: 'title is required' })
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw createError({ statusCode: 400, message: `title must be ${MAX_TITLE_LENGTH} characters or fewer` })
  }

  const description = typeof body.description === 'string' ? body.description.trim() : null
  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw createError({ statusCode: 400, message: `description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` })
  }

  // Resolve workspace from agent's membership
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : null

  let resolvedWorkspaceId: string

  if (workspaceId) {
    // Verify agent is a member
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: agent.id } },
      select: { id: true },
    })
    if (!membership) {
      throw createError({ statusCode: 403, message: 'Not a member of this workspace' })
    }
    resolvedWorkspaceId = workspaceId
  } else {
    // Use agent's first (or only) workspace
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: agent.id },
      select: { workspaceId: true },
      orderBy: { joinedAt: 'asc' },
    })
    if (!membership) {
      throw createError({ statusCode: 400, message: 'Agent is not a member of any workspace' })
    }
    resolvedWorkspaceId = membership.workspaceId
  }

  const project = await prisma.$transaction(async (tx) => {
    const item = await tx.item.create({
      data: {
        title,
        description,
        workspaceId: resolvedWorkspaceId,
        parentId: null,
        itemType: 'WORKSTREAM',
        status: 'TODO',
        progress: 0,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        progress: true,
      },
    })

    // Auto-assign the agent to the project
    await tx.itemAssignment.create({
      data: {
        itemId: item.id,
        userId: agent.id,
      },
    })

    return item
  })

  return project
})
