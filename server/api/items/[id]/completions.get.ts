import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const days = Number(query.days) || 14

  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  // Start from (days - 1) days ago to include today
  // e.g., days=14 means "last 14 days including today"
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (days - 1))
  startDate.setHours(0, 0, 0, 0)

  // Check if this is a root project (no parent) to decide query strategy
  const item = await prisma.item.findUnique({
    where: { id },
    select: { parentId: true }
  })

  let itemIds: string[]

  if (!item?.parentId) {
    // Root project: use efficient projectId query
    // All descendants have projectId pointing to this item
    itemIds = [id]
    const descendants = await prisma.item.findMany({
      where: { projectId: id },
      select: { id: true }
    })
    itemIds.push(...descendants.map(d => d.id))
  } else {
    // Non-root item: need to get descendants via parentId chain
    itemIds = [id, ...(await getDescendantIds(id))]
  }

  // Get completed items from our ID list
  const completedItems = await prisma.item.findMany({
    where: {
      id: { in: itemIds },
      completedAt: { gte: startDate },
      status: 'DONE',
    },
    select: {
      id: true,
      title: true,
      completedAt: true,
    },
    orderBy: { completedAt: 'asc' }
  })

  // Get focus time for completed items
  const completedItemIds = completedItems.map(item => item.id)

  const focusSessions = await prisma.focusSession.findMany({
    where: {
      taskId: { in: completedItemIds },
      endedAt: { not: null },
    },
    select: {
      taskId: true,
      startedAt: true,
      endedAt: true,
    }
  })

  // Calculate total focus time per item
  const focusTimeByItem: Record<string, number> = {}
  for (const session of focusSessions) {
    if (!session.taskId || !session.endedAt) continue
    const duration = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
    focusTimeByItem[session.taskId] = (focusTimeByItem[session.taskId] || 0) + duration
  }

  // Aggregate into daily buckets
  const dailyCompletions: Record<string, Array<{
    id: string
    title: string
    completedAt: Date
    timeWorked: number // in minutes
  }>> = {}

  // Initialize all days (use local date, not UTC)
  const formatLocalDate = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const key = formatLocalDate(date)
    dailyCompletions[key] = []
  }

  // Group completions by day (use local date to match heatmap keys)
  for (const item of completedItems) {
    if (!item.completedAt) continue
    const dayKey = formatLocalDate(new Date(item.completedAt))

    if (dailyCompletions[dayKey]) {
      const timeWorkedMs = focusTimeByItem[item.id] || 0
      const timeWorkedMinutes = Math.round(timeWorkedMs / (1000 * 60))

      dailyCompletions[dayKey].push({
        id: item.id,
        title: item.title,
        completedAt: item.completedAt,
        timeWorked: timeWorkedMinutes,
      })
    }
  }

  // Convert to array format for the heatmap
  const heatmap = Object.entries(dailyCompletions).map(([date, completions]) => ({
    date,
    count: completions.length,
    intensity: Math.min(4, completions.length), // 0-4 intensity levels based on count
    completions,
  }))

  const totalCompletions = heatmap.reduce((sum, d) => sum + d.count, 0)

  return {
    itemId: id,
    days,
    heatmap,
    totalCompletions,
  }
})

// Recursive function to get all descendant IDs (for non-root items)
async function getDescendantIds(itemId: string): Promise<string[]> {
  const children = await prisma.item.findMany({
    where: { parentId: itemId },
    select: { id: true }
  })

  const childIds = children.map(c => c.id)
  const grandchildIds = await Promise.all(childIds.map(id => getDescendantIds(id)))

  return [...childIds, ...grandchildIds.flat()]
}
