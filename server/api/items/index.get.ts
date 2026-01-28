import { prisma } from '../../utils/prisma'
import { calculateTemperature } from '../../utils/temperature'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string
  const parentId = query.parentId as string | undefined
  
  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }
  
  // Fetch items at the specified level
  const items = await prisma.item.findMany({
    where: {
      workspaceId,
      parentId: parentId === 'root' ? null : parentId ?? null,
    },
    include: {
      assignees: {
        include: { user: true }
      },
      stakeholders: {
        include: { user: true }
      },
      blockedBy: true,
      children: {
        include: {
          children: true, // One level deeper for counting
          blockedBy: true,
        }
      },
    },
    orderBy: { createdAt: 'asc' }
  })
  
  // Transform and calculate derived fields
  return items.map(item => {
    const childrenCount = countAllChildren(item)
    const hotCount = countByTemperature(item, ['hot', 'critical'])
    const blockedCount = countByStatus(item, 'BLOCKED')
    
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      parentId: item.parentId,
      status: item.status.toLowerCase(),
      category: item.category,
      dueDate: item.dueDate?.toISOString() ?? null,
      startDate: item.startDate?.toISOString() ?? null,
      progress: item.progress ?? 0,
      confidence: item.confidence,
      temperature: calculateTemperature(item),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      lastActivityAt: item.lastActivityAt.toISOString(),
      // Assignee (first one)
      assignee: item.assignees[0]?.user ? {
        id: item.assignees[0].user.id,
        name: item.assignees[0].user.name,
        avatar: item.assignees[0].user.avatar,
      } : null,
      // All assignees
      assignees: item.assignees.map(a => ({
        id: a.user.id,
        name: a.user.name,
        avatar: a.user.avatar,
      })),
      // Stakeholders
      stakeholders: item.stakeholders.map(s => ({
        id: s.user.id,
        name: s.user.name,
        avatar: s.user.avatar,
      })),
      // Dependencies
      dependencyIds: item.blockedBy.map(d => d.blockingItemId),
      // Children stats
      childrenCount,
      hotChildrenCount: hotCount,
      blockedChildrenCount: blockedCount,
      hasChildren: item.children.length > 0,
      // Direct children (for timeline expansion)
      children: item.children.map((child: any) => ({
        id: child.id,
        title: child.title,
        description: child.description,
        parentId: child.parentId,
        status: child.status.toLowerCase(),
        category: child.category,
        dueDate: child.dueDate?.toISOString() ?? null,
        startDate: child.startDate?.toISOString() ?? null,
        progress: child.progress ?? 0,
        confidence: child.confidence,
        temperature: calculateTemperature(child),
        childrenCount: child.children?.length ?? 0,
        hasChildren: (child.children?.length ?? 0) > 0,
      })),
    }
  })
})

function countAllChildren(item: any): number {
  if (!item.children?.length) return 0
  return item.children.length + item.children.reduce((sum: number, c: any) => sum + countAllChildren(c), 0)
}

function countByTemperature(item: any, temps: string[]): number {
  if (!item.children?.length) return 0
  let count = 0
  for (const child of item.children) {
    const temp = calculateTemperature(child)
    if (temps.includes(temp)) count++
    count += countByTemperature(child, temps)
  }
  return count
}

function countByStatus(item: any, status: string): number {
  if (!item.children?.length) return 0
  let count = 0
  for (const child of item.children) {
    if (child.status === status) count++
    count += countByStatus(child, status)
  }
  return count
}
