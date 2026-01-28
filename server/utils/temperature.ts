import type { Item, ItemDependency } from '@prisma/client'

export type Temperature = 'cold' | 'warm' | 'hot' | 'critical'

interface ItemWithRelations extends Item {
  blockedBy?: ItemDependency[]
  children?: ItemWithRelations[]
}

/**
 * Calculate temperature based on:
 * - Time since last activity
 * - Proximity to due date
 * - Number of blockers
 * - Status (blocked = critical)
 */
export function calculateTemperature(item: ItemWithRelations): Temperature {
  // Blocked items are always critical
  if (item.status === 'BLOCKED') {
    return 'critical'
  }
  
  // Done items are cold
  if (item.status === 'DONE') {
    return 'cold'
  }
  
  let heatScore = 0
  const now = new Date()
  
  // Factor 1: Time since last activity (staleness)
  const daysSinceActivity = Math.floor(
    (now.getTime() - new Date(item.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysSinceActivity > 14) heatScore += 2
  else if (daysSinceActivity > 7) heatScore += 1
  
  // Factor 2: Due date proximity
  if (item.dueDate) {
    const daysUntilDue = Math.floor(
      (new Date(item.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysUntilDue < 0) heatScore += 3 // Overdue
    else if (daysUntilDue < 3) heatScore += 2
    else if (daysUntilDue < 7) heatScore += 1
  }
  
  // Factor 3: Blockers
  const blockerCount = item.blockedBy?.length ?? 0
  if (blockerCount > 0) heatScore += blockerCount
  
  // Factor 4: Low confidence on in-progress items
  if (item.status === 'IN_PROGRESS' && item.confidence < 50) {
    heatScore += 1
  }
  
  // Map score to temperature
  if (heatScore >= 4) return 'critical'
  if (heatScore >= 2) return 'hot'
  if (heatScore >= 1) return 'warm'
  return 'cold'
}

/**
 * Calculate effective temperature including children
 * Returns the hottest temperature among item and all descendants
 */
export function calculateEffectiveTemperature(item: ItemWithRelations): Temperature {
  const ownTemp = calculateTemperature(item)
  
  if (!item.children?.length) return ownTemp
  
  const temps = [ownTemp, ...item.children.map(c => calculateEffectiveTemperature(c))]
  
  const priority: Record<Temperature, number> = {
    cold: 0,
    warm: 1,
    hot: 2,
    critical: 3
  }
  
  const maxPriority = Math.max(...temps.map(t => priority[t]))
  return Object.entries(priority).find(([_, p]) => p === maxPriority)?.[0] as Temperature ?? 'cold'
}
