import { requireOrgAdmin } from '../../../utils/auth'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const organizationId = getRouterParam(event, 'id')
  if (!organizationId) {
    throw createError({ statusCode: 400, message: 'Organization ID is required' })
  }

  await requireOrgAdmin(event, organizationId)

  const workspaces = await prisma.workspace.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      _count: {
        select: {
          items: true,
          members: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Get project counts (items with no parent) per workspace
  const workspaceIds = workspaces.map((w) => w.id)
  const projectCounts = await prisma.item.groupBy({
    by: ['workspaceId'],
    where: {
      workspaceId: { in: workspaceIds },
      parentId: null,
    },
    _count: true,
  })

  const projectCountMap = new Map(projectCounts.map((p) => [p.workspaceId, p._count]))

  return workspaces.map((w) => ({
    id: w.id,
    name: w.name,
    slug: w.slug,
    description: w.description,
    createdAt: w.createdAt,
    itemCount: w._count.items,
    memberCount: w._count.members,
    projectCount: projectCountMap.get(w.id) ?? 0,
  }))
})
