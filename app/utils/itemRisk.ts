import type { ItemNode } from '~/types'

export interface ItemEstimateMeta {
  isAtRisk: boolean
  needsEstimate: boolean
  missProb: number
}

const AT_RISK_THRESHOLD = 33

export function getItemEstimateMeta(item: Pick<ItemNode, 'status' | 'dueDate' | 'startDate' | 'progress' | 'confidence'>): ItemEstimateMeta {
  const status = item.status

  if (status === 'done') return { isAtRisk: false, needsEstimate: false, missProb: 0 }
  if (status === 'blocked') return { isAtRisk: false, needsEstimate: false, missProb: 0 }
  if (!item.dueDate) return { isAtRisk: false, needsEstimate: false, missProb: 0 }

  const progress = item.progress ?? 0
  if (!item.startDate || progress <= 0) {
    return { isAtRisk: false, needsEstimate: true, missProb: 0 }
  }
  if (progress >= 100) return { isAtRisk: false, needsEstimate: false, missProb: 0 }

  const confidence = item.confidence ?? 70
  const now = new Date()
  const startDate = new Date(item.startDate)

  const daysSpent = Math.max(1, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
  const totalEstimate = Math.round(daysSpent / (progress / 100))
  const remainingDays = Math.max(1, totalEstimate - daysSpent)

  const bandDays = Math.ceil(remainingDays * (1 - confidence / 100) * 2)
  const stdDev = Math.max(1, bandDays / 4)

  const dueDate = new Date(item.dueDate)
  const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const zScore = (daysUntilDue - remainingDays) / stdDev

  // Logistic approximation of the normal CDF
  const cdf = 1 / (1 + Math.exp(-1.702 * zScore))
  let missProb = Math.round((1 - cdf) * 100)
  missProb = Math.max(0, Math.min(100, missProb))

  return {
    isAtRisk: missProb >= AT_RISK_THRESHOLD,
    needsEstimate: false,
    missProb,
  }
}
