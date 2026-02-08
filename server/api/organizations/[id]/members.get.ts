import { requireOrgAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')
  if (!organizationId) {
    throw createError({ statusCode: 400, message: 'Organization ID is required' })
  }

  await requireOrgAdmin(event, organizationId)

  const query = getQuery(event)
  const includeDeactivated = query.includeDeactivated === 'true'

  const where: any = { organizationId }
  if (!includeDeactivated) {
    where.status = 'ACTIVE'
  }

  const members = await prisma.organizationMember.findMany({
    where,
    select: {
      id: true,
      role: true,
      status: true,
      joinedAt: true,
      userId: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          position: true,
          avatar: true,
          workspaceMembers: {
            where: {
              workspace: { organizationId },
              status: 'ACTIVE',
            },
            select: {
              role: true,
              workspace: {
                select: { id: true, name: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  })

  return members.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    position: m.user.position,
    avatar: m.user.avatar,
    orgRole: m.role,
    status: m.status,
    joinedAt: m.joinedAt,
    workspaces: m.user.workspaceMembers.map((wm) => ({
      id: wm.workspace.id,
      name: wm.workspace.name,
      role: wm.role,
    })),
  }))
})
