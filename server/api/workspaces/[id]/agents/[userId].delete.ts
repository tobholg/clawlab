import { requireMinRole, requireWorkspaceMember } from '../../../../utils/auth'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')
  const userId = getRouterParam(event, 'userId')

  if (!workspaceId || !userId) {
    throw createError({ statusCode: 400, message: 'Workspace ID and user ID are required' })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)
  requireMinRole(auth, 'ADMIN')

  if (!auth.isOrgAdmin) {
    throw createError({ statusCode: 403, message: 'Organization admin access required' })
  }

  if (auth.user.id === userId) {
    throw createError({ statusCode: 400, message: 'Cannot remove yourself' })
  }

  const [workspace, membership] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    }),
    prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            isAgent: true,
          },
        },
      },
    }),
  ])

  if (!workspace) {
    throw createError({ statusCode: 404, message: 'Workspace not found' })
  }

  if (!membership) {
    throw createError({ statusCode: 404, message: 'Agent not found in workspace' })
  }

  if (!membership.user.isAgent) {
    throw createError({ statusCode: 400, message: 'Target user is not an agent' })
  }

  await prisma.$transaction(async (tx) => {
    await tx.channelMember.deleteMany({
      where: {
        userId,
        channel: { workspaceId },
      },
    })

    await tx.itemAssignment.deleteMany({
      where: {
        userId,
        item: { workspaceId },
      },
    })

    await tx.workspaceMember.delete({
      where: { id: membership.id },
    })

    const hasOtherWorkspaceMembershipsInOrg = await tx.workspaceMember.count({
      where: {
        userId,
        status: 'ACTIVE',
        workspace: {
          organizationId: workspace.organizationId,
        },
      },
    })

    if (!hasOtherWorkspaceMembershipsInOrg) {
      await tx.organizationMember.deleteMany({
        where: {
          organizationId: workspace.organizationId,
          userId,
        },
      })
    }
  })

  return { success: true }
})
