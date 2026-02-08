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

  const query = getQuery(event)
  const includeDeactivated = query.includeDeactivated === 'true'

  const where: any = { workspaceId }
  if (!includeDeactivated) {
    where.status = 'ACTIVE'
  }

  const members = await prisma.workspaceMember.findMany({
    where,
    include: {
      user: { select: { id: true, email: true, name: true, avatar: true } }
    },
    orderBy: { joinedAt: 'asc' }
  })

  return members.map(m => ({
    id: m.id,
    userId: m.user.id,
    email: m.user.email,
    name: m.user.name,
    avatar: m.user.avatar,
    role: m.role,
    status: m.status,
    joinedAt: m.joinedAt.toISOString(),
  }))
})
