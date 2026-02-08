import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)
  const days = Number(query.days) || 14

  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  await requireWorkspaceMemberForItem(event, id)
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)
  
  // Get all descendant item IDs (recursive)
  const descendantIds = await getDescendantIds(id)
  const allItemIds = [id, ...descendantIds]
  
  // Get all focus sessions for this item and descendants (task or project)
  const sessions = await prisma.focusSession.findMany({
    where: {
      OR: [
        { taskId: { in: allItemIds } },
        { projectId: { in: allItemIds } },
      ],
      startedAt: { gte: startDate },
    },
    select: {
      startedAt: true,
      endedAt: true,
      userId: true,
    }
  })
  
  // Aggregate into daily buckets
  const dailyActivity: Record<string, { hours: number; users: Set<string> }> = {}
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const key = date.toISOString().split('T')[0]
    dailyActivity[key] = { hours: 0, users: new Set() }
  }
  
  for (const session of sessions) {
    const sessionStart = new Date(session.startedAt)
    const sessionEnd = session.endedAt ? new Date(session.endedAt) : new Date()
    
    // For each day the session spans
    let currentDay = new Date(sessionStart)
    currentDay.setHours(0, 0, 0, 0)
    
    while (currentDay <= sessionEnd && currentDay <= new Date()) {
      const dayKey = currentDay.toISOString().split('T')[0]
      
      if (dailyActivity[dayKey]) {
        // Calculate hours for this day
        const dayStart = new Date(currentDay)
        const dayEnd = new Date(currentDay)
        dayEnd.setHours(23, 59, 59, 999)
        
        const effectiveStart = sessionStart > dayStart ? sessionStart : dayStart
        const effectiveEnd = sessionEnd < dayEnd ? sessionEnd : dayEnd
        
        const hours = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60)
        dailyActivity[dayKey].hours += Math.max(0, hours)
        dailyActivity[dayKey].users.add(session.userId)
      }
      
      currentDay.setDate(currentDay.getDate() + 1)
    }
  }
  
  // Convert to array format for the heatmap
  const heatmap = Object.entries(dailyActivity).map(([date, data]) => ({
    date,
    hours: Math.round(data.hours * 10) / 10,
    intensity: Math.min(4, Math.floor(data.hours / 2)), // 0-4 intensity levels
    userCount: data.users.size,
  }))
  
  return {
    itemId: id,
    days,
    heatmap,
    totalHours: Math.round(heatmap.reduce((sum, d) => sum + d.hours, 0) * 10) / 10,
  }
})

// Recursive function to get all descendant IDs
async function getDescendantIds(itemId: string): Promise<string[]> {
  const children = await prisma.item.findMany({
    where: { parentId: itemId },
    select: { id: true }
  })
  
  const childIds = children.map(c => c.id)
  const grandchildIds = await Promise.all(childIds.map(id => getDescendantIds(id)))
  
  return [...childIds, ...grandchildIds.flat()]
}
