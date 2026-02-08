import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: user.id,
      }
    },
    select: {
      role: true,
      status: true,
      joinedAt: true,
    }
  })

  if (!membership || membership.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, message: 'Not a workspace member' })
  }

  return {
    workspaceId,
    role: membership.role,
    joinedAt: membership.joinedAt.toISOString(),
  }
})
