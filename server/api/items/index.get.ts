import { prisma } from '../../utils/prisma'
import { calculateTemperature } from '../../utils/temperature'
import { getEstimateMeta } from '../../utils/estimate'

// Deep include for children up to 4 levels
const childrenInclude = {
  owner: true,
  assignees: { include: { user: true } },
  blockedBy: true,
  children: {
    include: {
      owner: true,
      assignees: { include: { user: true } },
      blockedBy: true,
      children: {
        include: {
          owner: true,
          assignees: { include: { user: true } },
          blockedBy: true,
          children: {
            include: {
              owner: true,
              assignees: { include: { user: true } },
              blockedBy: true,
            }
          }
        }
      }
    }
  }
}

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
      owner: true,
      assignees: {
        include: { user: true }
      },
      stakeholders: {
        include: { user: true }
      },
      blockedBy: true,
      children: {
        include: childrenInclude
      },
    },
    orderBy: { createdAt: 'asc' }
  })
  
  // Transform item recursively
  function transformItem(item: any, depth: number = 0): any {
    const childrenCount = countAllChildren(item)
    const hotCount = countByTemperature(item, ['hot', 'critical'])
    const blockedCount = countByStatus(item, 'BLOCKED')
    const completedCount = countByStatus(item, 'DONE')
    const atRiskCount = countAtRisk(item)
    const needsEstimateCount = countNeedsEstimate(item)

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      parentId: item.parentId,
      status: item.status.toLowerCase(),
      subStatus: item.subStatus ?? null,
      category: item.category,
      complexity: item.complexity ?? null,
      priority: item.priority ?? null,
      dueDate: item.dueDate?.toISOString() ?? null,
      startDate: item.startDate?.toISOString() ?? null,
      progress: item.progress ?? 0,
      confidence: item.confidence,
      temperature: calculateTemperature(item),
      createdAt: item.createdAt?.toISOString() ?? null,
      updatedAt: item.updatedAt?.toISOString() ?? null,
      lastActivityAt: item.lastActivityAt?.toISOString() ?? null,
      // Owner - the primary responsible person
      owner: item.owner ? {
        id: item.owner.id,
        name: item.owner.name,
        avatar: item.owner.avatar,
      } : null,
      // Legacy assignee field (for backwards compatibility)
      assignee: item.owner ? {
        id: item.owner.id,
        name: item.owner.name,
        avatar: item.owner.avatar,
        role: 'owner',
      } : null,
      // All assignees
      assignees: item.assignees?.map((a: any) => ({
        id: a.user.id,
        name: a.user.name,
        avatar: a.user.avatar,
      })) ?? [],
      // Dependencies
      dependencyIds: item.blockedBy?.map((d: any) => d.blockingItemId) ?? [],
      isBlocked: (item.blockedBy?.length ?? 0) > 0,
      // Children stats
      childrenCount,
      completedChildrenCount: completedCount,
      activeChildrenCount: Math.max(0, childrenCount - completedCount),
      hotChildrenCount: hotCount,
      blockedChildrenCount: blockedCount,
      atRiskChildrenCount: atRiskCount,
      needsEstimateChildrenCount: needsEstimateCount,
      hasChildren: (item.children?.length ?? 0) > 0,
      // Recursive children (up to 4 levels)
      children: depth < 4 && item.children?.length
        ? item.children.map((child: any) => transformItem(child, depth + 1))
        : [],
    }
  }
  
  // Transform top-level items (include stakeholders only at top level)
  return items.map(item => {
    const transformed = transformItem(item, 0)
    transformed.stakeholders = item.stakeholders.map((s: any) => ({
      id: s.user.id,
      name: s.user.name,
      avatar: s.user.avatar,
    }))
    return transformed
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

// Count children at risk of missing their due date (miss probability >= threshold)
function countAtRisk(item: any): number {
  if (!item.children?.length) return 0
  let count = 0

  for (const child of item.children) {
    const meta = getEstimateMeta(child)
    if (meta.isAtRisk) count++
    count += countAtRisk(child)
  }
  return count
}

// Count children that need estimate inputs (due date set but no start/progress)
function countNeedsEstimate(item: any): number {
  if (!item.children?.length) return 0
  let count = 0

  for (const child of item.children) {
    const meta = getEstimateMeta(child)
    if (meta.needsEstimate) count++
    count += countNeedsEstimate(child)
  }
  return count
}
