import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const workspaceId = getRouterParam(event, 'id')

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  }

  // Verify membership
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } }
  })

  if (!membership || membership.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, message: 'Not a workspace member' })
  }

  // Get all external spaces for projects in this workspace
  const spaces = await prisma.externalSpace.findMany({
    where: {
      archived: false,
      project: { workspaceId },
    },
    include: {
      project: { select: { id: true, title: true } },
      stakeholderAccess: {
        include: {
          user: { select: { id: true, email: true, name: true, avatar: true } },
          inviter: { select: { id: true, name: true } },
        },
        orderBy: { invitedAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return spaces.map(space => ({
    id: space.id,
    name: space.name,
    slug: space.slug,
    description: space.description,
    allowTaskSubmission: space.allowTaskSubmission,
    maxIRsPer24h: space.maxIRsPer24h,
    project: {
      id: space.project.id,
      title: space.project.title,
    },
    stakeholders: space.stakeholderAccess.map(sa => ({
      userId: sa.user.id,
      email: sa.user.email,
      name: sa.displayName || sa.user.name,
      avatar: sa.user.avatar,
      position: sa.position,
      canSubmitTasks: sa.canSubmitTasks,
      maxIRsPer24h: sa.maxIRsPer24h,
      invitedAt: sa.invitedAt.toISOString(),
      invitedBy: sa.inviter ? { id: sa.inviter.id, name: sa.inviter.name } : null,
    })),
  }))
})
