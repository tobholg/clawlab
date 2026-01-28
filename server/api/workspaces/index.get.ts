import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  // TODO: Filter by user membership when auth is integrated
  const workspaces = await prisma.workspace.findMany({
    include: {
      _count: {
        select: { items: true, members: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })
  
  return workspaces.map(ws => ({
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    description: ws.description,
    itemCount: ws._count.items,
    memberCount: ws._count.members,
    createdAt: ws.createdAt.toISOString(),
  }))
})
