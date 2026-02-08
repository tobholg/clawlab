import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  // Get user's org memberships to determine access
  const orgMemberships = await prisma.organizationMember.findMany({
    where: { userId: user.id, status: 'ACTIVE' },
    select: { organizationId: true, role: true },
  })

  const orgIds = orgMemberships.map(m => m.organizationId)
  const adminOrgIds = orgMemberships
    .filter(m => m.role === 'OWNER' || m.role === 'ADMIN')
    .map(m => m.organizationId)

  // Org OWNER/ADMIN: see ALL workspaces in their org(s)
  // Regular members: see only workspaces with active WorkspaceMember
  const workspaces = await prisma.workspace.findMany({
    where: {
      OR: [
        // Workspaces in orgs where user is OWNER/ADMIN
        ...(adminOrgIds.length > 0 ? [{ organizationId: { in: adminOrgIds } }] : []),
        // Workspaces with explicit membership
        { members: { some: { userId: user.id, status: 'ACTIVE' } } },
      ],
    },
    include: {
      organization: { select: { id: true, name: true } },
      _count: {
        select: { items: true, members: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return workspaces.map(ws => ({
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    description: ws.description,
    organizationId: ws.organizationId,
    organizationName: ws.organization.name,
    itemCount: ws._count.items,
    memberCount: ws._count.members,
    createdAt: ws.createdAt.toISOString(),
  }))
})
