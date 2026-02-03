import { defineEventHandler, getRouterParam, createError } from 'h3'
import { prisma } from '../../../utils/prisma'
import { requireUser } from '../../../utils/auth'

interface TaskNode {
  id: string
  title: string
  status: string
  subStatus: string | null
  progress: number
  confidence: number
  startDate: string | null
  dueDate: string | null
  childrenCount: number
  completedChildrenCount: number
  children: TaskNode[]
}

interface ActivityDay {
  date: string
  count: number
  level: 0 | 1 | 2 | 3 | 4
  completions: Array<{ id: string; title: string }>
}

// Get space overview for stakeholder portal
// Returns: space info, project info, active tasks (hierarchical), completed tasks, activity data
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const spaceSlug = getRouterParam(event, 'spaceSlug')

  if (!spaceSlug) {
    throw createError({ statusCode: 400, statusMessage: 'Space slug is required' })
  }

  // Find space and verify user has access
  const space = await prisma.externalSpace.findFirst({
    where: {
      slug: spaceSlug,
      archived: false
    },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          description: true,
          workspaceId: true,
          progress: true,
          confidence: true,
          createdAt: true,
        }
      },
      stakeholderAccess: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            }
          }
        }
      }
    }
  })

  if (!space) {
    throw createError({ statusCode: 404, statusMessage: 'Portal not found' })
  }

  // Check if user has stakeholder access
  const access = await prisma.stakeholderAccess.findUnique({
    where: {
      userId_externalSpaceId: {
        userId: user.id,
        externalSpaceId: space.id
      }
    }
  })

  if (!access) {
    throw createError({ statusCode: 403, statusMessage: 'You do not have access to this portal' })
  }

  // Get all project items
  const allItems = await prisma.item.findMany({
    where: {
      OR: [
        { id: space.projectId },
        { projectId: space.projectId }
      ],
      parentId: { not: null } // Exclude the project root itself
    },
    select: {
      id: true,
      title: true,
      status: true,
      subStatus: true,
      progress: true,
      confidence: true,
      startDate: true,
      dueDate: true,
      parentId: true,
      completedAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  // Build hierarchical structure for active tasks
  const activeStatuses = ['TODO', 'IN_PROGRESS', 'BLOCKED']
  const activeItems = allItems.filter(item => activeStatuses.includes(item.status))
  
  // Group items by parent
  const itemsByParent = new Map<string | null, typeof allItems>()
  for (const item of activeItems) {
    const parentId = item.parentId
    if (!itemsByParent.has(parentId)) {
      itemsByParent.set(parentId, [])
    }
    itemsByParent.get(parentId)!.push(item)
  }

  // Build tree recursively
  const buildTree = (parentId: string | null, depth: number = 0): TaskNode[] => {
    const children = itemsByParent.get(parentId) || []
    if (depth > 3) return [] // Limit depth for performance
    
    return children.map(item => {
      const childNodes = buildTree(item.id, depth + 1)
      
      // Count direct children only (simplified - no deep descendant traversal)
      const directChildren = allItems.filter(i => i.parentId === item.id)
      const completedDirectChildren = directChildren.filter(i => i.status === 'DONE')
      
      return {
        id: item.id,
        title: item.title,
        status: item.status.toLowerCase(),
        subStatus: item.subStatus,
        progress: item.progress,
        confidence: item.confidence,
        startDate: item.startDate?.toISOString() || null,
        dueDate: item.dueDate?.toISOString() || null,
        childrenCount: directChildren.length,
        completedChildrenCount: completedDirectChildren.length,
        children: childNodes,
      }
    })
  }

  // Get top-level active tasks (those whose parent is the project itself)
  const topLevelTasks = buildTree(space.projectId, 0)

  // Get recently completed tasks (last 20) - top-level only (direct children of project)
  const completedItems = await prisma.item.findMany({
    where: {
      projectId: space.projectId,
      parentId: space.projectId, // Only top-level items
      status: 'DONE',
      completedAt: { not: null },
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'desc' },
    take: 20
  })

  // Get all completed items (for children lookup)
  const allCompletedItems = await prisma.item.findMany({
    where: {
      projectId: space.projectId,
      status: 'DONE',
    },
    select: {
      id: true,
      title: true,
      parentId: true,
      startDate: true,
      completedAt: true,
    }
  })

  // Build completed tasks tree
  interface CompletedTaskNode {
    id: string
    title: string
    startDate: string | null
    completedAt: string | null
    durationDays: number | null
    childrenCount: number
    children: CompletedTaskNode[]
  }

  const completedItemsByParent = new Map<string, typeof allCompletedItems>()
  for (const item of allCompletedItems) {
    const parentId = item.parentId || ''
    if (!completedItemsByParent.has(parentId)) {
      completedItemsByParent.set(parentId, [])
    }
    completedItemsByParent.get(parentId)!.push(item)
  }

  const buildCompletedTree = (parentId: string, depth: number = 0): CompletedTaskNode[] => {
    const children = completedItemsByParent.get(parentId) || []
    if (depth > 2) return [] // Limit depth

    return children.map(item => {
      const childNodes = buildCompletedTree(item.id, depth + 1)
      
      // Calculate duration in days
      let durationDays: number | null = null
      if (item.startDate && item.completedAt) {
        durationDays = Math.ceil(
          (item.completedAt.getTime() - item.startDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      }

      return {
        id: item.id,
        title: item.title,
        startDate: item.startDate?.toISOString() || null,
        completedAt: item.completedAt?.toISOString() || null,
        durationDays,
        childrenCount: childNodes.length,
        children: childNodes,
      }
    }).sort((a, b) => {
      // Sort by completedAt descending
      const aDate = a.completedAt ? new Date(a.completedAt).getTime() : 0
      const bDate = b.completedAt ? new Date(b.completedAt).getTime() : 0
      return bDate - aDate
    })
  }

  // Build completed tasks with their children
  const completedTasks: CompletedTaskNode[] = completedItems.map(item => {
    const childNodes = buildCompletedTree(item.id, 0)
    
    let durationDays: number | null = null
    if (item.startDate && item.completedAt) {
      durationDays = Math.ceil(
        (item.completedAt.getTime() - item.startDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    }

    return {
      id: item.id,
      title: item.title,
      startDate: item.startDate?.toISOString() || null,
      completedAt: item.completedAt?.toISOString() || null,
      durationDays,
      childrenCount: childNodes.length,
      children: childNodes,
    }
  })

  // Generate activity data for the last 16 weeks
  const weeks = 16
  const now = new Date()
  now.setHours(12, 0, 0, 0) // Normalize to midday
  
  // End date aligned to Saturday (end of week)
  const endDate = new Date(now)
  const daysUntilSaturday = (6 - endDate.getDay() + 7) % 7
  endDate.setDate(endDate.getDate() + daysUntilSaturday)
  
  // Start date aligned to Sunday (weeks ago)
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (weeks * 7) + 1)
  startDate.setHours(0, 0, 0, 0)

  // Helper to format date as YYYY-MM-DD in local time
  const formatLocalDate = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Get completions in the time range (with buffer for timezone safety)
  const queryStartDate = new Date(startDate)
  queryStartDate.setDate(queryStartDate.getDate() - 1)
  const queryEndDate = new Date(endDate)
  queryEndDate.setDate(queryEndDate.getDate() + 1)

  const completionsInRange = await prisma.item.findMany({
    where: {
      OR: [
        { id: space.projectId },
        { projectId: space.projectId }
      ],
      status: 'DONE',
      completedAt: {
        gte: queryStartDate,
        lte: queryEndDate,
      },
    },
    select: {
      id: true,
      title: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'desc' },
  })

  // Group completions by local date
  const completionsByDate = new Map<string, Array<{ id: string; title: string }>>()
  for (const item of completionsInRange) {
    if (!item.completedAt) continue
    const dateStr = formatLocalDate(item.completedAt)
    if (!completionsByDate.has(dateStr)) {
      completionsByDate.set(dateStr, [])
    }
    completionsByDate.get(dateStr)!.push({ id: item.id, title: item.title })
  }

  // Calculate max completions for normalization
  const maxCompletions = Math.max(...Array.from(completionsByDate.values()).map(c => c.length), 1)

  // Generate activity data for each day
  const activityData: ActivityDay[] = []
  const currentDate = new Date(startDate)
  
  while (currentDate <= endDate) {
    const dateStr = formatLocalDate(currentDate)
    const completions = completionsByDate.get(dateStr) || []
    const count = completions.length
    
    // Calculate level (0-4) based on activity
    let level: 0 | 1 | 2 | 3 | 4 = 0
    if (count > 0) {
      const ratio = count / maxCompletions
      if (ratio > 0.75) level = 4
      else if (ratio > 0.5) level = 3
      else if (ratio > 0.25) level = 2
      else level = 1
    }
    
    activityData.push({
      date: dateStr,
      count,
      level,
      completions,
    })
    
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Calculate overall stats
  const totalActive = activeItems.length
  const totalCompleted = activityData.reduce((sum, day) => sum + day.count, 0)
  const avgProgress = activeItems.length > 0 
    ? Math.round(activeItems.reduce((sum, item) => sum + item.progress, 0) / activeItems.length)
    : 0
  const avgConfidence = activeItems.length > 0
    ? Math.round(activeItems.reduce((sum, item) => sum + item.confidence, 0) / activeItems.length)
    : 0

  // Determine effective permissions
  const canSubmitTasks = access.canSubmitTasks ?? space.allowTaskSubmission

  // Build stakeholders list
  const stakeholders = space.stakeholderAccess.map(s => ({
    id: s.user.id,
    name: s.user.name,
    email: s.user.email,
    displayName: s.displayName,
    position: s.position,
    joinedAt: s.createdAt?.toISOString() || new Date().toISOString(),
  }))

  return {
    id: space.id,
    name: space.name,
    slug: space.slug,
    description: space.description,
    project: {
      id: space.project.id,
      title: space.project.title,
      description: space.project.description,
      progress: space.project.progress,
      confidence: space.project.confidence,
      createdAt: space.project.createdAt?.toISOString() || new Date().toISOString(),
    },
    stakeholders,
    stakeholderCount: stakeholders.length,
    activeTasks: topLevelTasks,
    completedTasks,
    activityData,
    stats: {
      totalActive,
      totalCompleted,
      avgProgress,
      avgConfidence,
      weeksTracked: weeks,
    },
    access: {
      canSubmitTasks,
      displayName: access.displayName,
      position: access.position
    }
  }
})
