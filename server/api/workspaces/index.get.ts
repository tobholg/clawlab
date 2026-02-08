import { prisma } from '../../utils/prisma'
import { getSessionUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await getSessionUser(event)

  const workspaces = await prisma.workspace.findMany({
    where: user
      ? { members: { some: { userId: user.id, status: 'ACTIVE' } } }
      : undefined,
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
