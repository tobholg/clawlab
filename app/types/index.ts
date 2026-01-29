// Recursive Item - the unified task/project model
export interface Item {
  id: string
  title: string
  description?: string | null
  parentId: string | null  // null = root project
  status: 'todo' | 'in_progress' | 'blocked' | 'paused' | 'done'
  subStatus?: string | null  // Sub-state within the status (e.g., 'scoping', 'review')
  temperature: 'cold' | 'warm' | 'hot' | 'critical'
  progress: number  // 0-100, completion percentage
  confidence: number  // 0-100, certainty of estimates
  dueDate: string | null
  startDate: string | null
  ownerId: string | null  // Single owner responsible for the item
  assigneeId: string | null  // Legacy - use ownerId
  stakeholderIds: string[]
  dependencyIds: string[]  // items this is blocked by
  category?: string
  createdAt: string
  updatedAt: string
}

export interface Person {
  id: string
  name: string
  avatar: string
  role?: string
}

// Computed tree node (Item + resolved relations)
export interface ItemNode extends Item {
  children: ItemNode[]
  owner: Person | null  // Primary owner responsible for the item
  assignee: Person | null  // Legacy - same as owner for backwards compatibility
  assignees: Person[]  // All people working on this item
  stakeholders: Person[]
  dependencies: ItemNode[]
  depth: number
  // Bubbled up from children
  childrenCount: number
  hotChildrenCount: number
  blockedChildrenCount: number
}

// Temperature config
export const TEMPERATURE_CONFIG = {
  cold: { 
    color: 'bg-slate-400', 
    textColor: 'text-slate-500',
    shadow: 'shadow-slate-200', 
    label: 'Stable',
    priority: 0
  },
  warm: { 
    color: 'bg-amber-400', 
    textColor: 'text-amber-600',
    shadow: 'shadow-amber-200', 
    label: 'Warming Up',
    priority: 1
  },
  hot: { 
    color: 'bg-orange-500', 
    textColor: 'text-orange-600',
    shadow: 'shadow-orange-200', 
    label: 'Needs Attention',
    priority: 2
  },
  critical: { 
    color: 'bg-rose-500', 
    textColor: 'text-rose-600',
    shadow: 'shadow-rose-200', 
    label: 'Critical',
    priority: 3
  },
} as const

export const STATUS_CONFIG = {
  todo: { label: 'To Do', color: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'In Progress', color: 'bg-blue-50 text-blue-600' },
  blocked: { label: 'Blocked', color: 'bg-rose-50 text-rose-600' },
  paused: { label: 'Paused', color: 'bg-amber-50 text-amber-600' },
  done: { label: 'Done', color: 'bg-emerald-50 text-emerald-600' },
} as const

// Sub-states for each status (with colors for badges)
export const SUB_STATUS_CONFIG: Record<string, { label: string; icon: string; order: number; color: string }> = {
  // Todo sub-states
  backlog: { label: 'Backlog', icon: 'heroicons:inbox', order: 0, color: 'bg-slate-100 text-slate-500' },
  ready: { label: 'Ready', icon: 'heroicons:check-circle', order: 1, color: 'bg-emerald-50 text-emerald-600' },
  // In Progress sub-states
  scoping: { label: 'Scoping', icon: 'heroicons:document-magnifying-glass', order: 0, color: 'bg-violet-50 text-violet-600' },
  active: { label: 'Active', icon: 'heroicons:play', order: 1, color: 'bg-blue-50 text-blue-600' },
  review: { label: 'Review', icon: 'heroicons:eye', order: 2, color: 'bg-amber-50 text-amber-600' },
  finalizing: { label: 'Finalizing', icon: 'heroicons:sparkles', order: 3, color: 'bg-cyan-50 text-cyan-600' },
  // Blocked sub-states
  dependency: { label: 'Dependency', icon: 'heroicons:link', order: 0, color: 'bg-rose-50 text-rose-600' },
  external: { label: 'External', icon: 'heroicons:arrow-top-right-on-square', order: 1, color: 'bg-orange-50 text-orange-600' },
  decision: { label: 'Awaiting Decision', icon: 'heroicons:question-mark-circle', order: 2, color: 'bg-pink-50 text-pink-600' },
  // Paused sub-states
  on_hold: { label: 'On Hold', icon: 'heroicons:pause', order: 0, color: 'bg-slate-100 text-slate-500' },
  deprioritized: { label: 'Deprioritized', icon: 'heroicons:arrow-down', order: 1, color: 'bg-slate-50 text-slate-400' },
}

// Sub-states grouped by parent status (for dropdowns)
export const SUB_STATUS_BY_STATUS = {
  todo: {
    backlog: SUB_STATUS_CONFIG.backlog,
    ready: SUB_STATUS_CONFIG.ready,
  },
  in_progress: {
    scoping: SUB_STATUS_CONFIG.scoping,
    active: SUB_STATUS_CONFIG.active,
    review: SUB_STATUS_CONFIG.review,
    finalizing: SUB_STATUS_CONFIG.finalizing,
  },
  blocked: {
    dependency: SUB_STATUS_CONFIG.dependency,
    external: SUB_STATUS_CONFIG.external,
    decision: SUB_STATUS_CONFIG.decision,
  },
  paused: {
    on_hold: SUB_STATUS_CONFIG.on_hold,
    deprioritized: SUB_STATUS_CONFIG.deprioritized,
  },
  done: {}, // No sub-states for done
} as const

export type SubStatus = {
  todo: keyof typeof SUB_STATUS_BY_STATUS.todo | null
  in_progress: keyof typeof SUB_STATUS_BY_STATUS.in_progress | null
  blocked: keyof typeof SUB_STATUS_BY_STATUS.blocked | null
  paused: keyof typeof SUB_STATUS_BY_STATUS.paused | null
  done: null
}

// Get sub-statuses for a given status (for dropdown menus)
export function getSubStatusesForStatus(status: string) {
  return SUB_STATUS_BY_STATUS[status as keyof typeof SUB_STATUS_BY_STATUS] ?? {}
}

export const CATEGORY_COLORS: Record<string, string> = {
  Engineering: 'bg-blue-50 text-blue-600 border-blue-100',
  Design: 'bg-violet-50 text-violet-600 border-violet-100',
  Marketing: 'bg-pink-50 text-pink-600 border-pink-100',
  Product: 'bg-slate-50 text-slate-600 border-slate-100',
}

// Calculate effective temperature (bubbles up from children)
export function calculateEffectiveTemperature(item: ItemNode): Item['temperature'] {
  if (item.children.length === 0) return item.temperature
  
  const temps = [item.temperature, ...item.children.map(c => calculateEffectiveTemperature(c))]
  const priorities = temps.map(t => TEMPERATURE_CONFIG[t].priority)
  const maxPriority = Math.max(...priorities)
  
  return Object.entries(TEMPERATURE_CONFIG)
    .find(([_, config]) => config.priority === maxPriority)?.[0] as Item['temperature'] ?? item.temperature
}

// Estimation metrics result
export interface EstimationMetrics {
  // Time tracking
  daysSpent: number
  estimatedTotalDays: number
  estimatedDaysRemaining: number
  
  // Date projections
  startDate: Date | null
  estimatedCompletionDate: Date | null
  
  // Uncertainty range (based on confidence)
  earliestCompletionDate: Date | null  // optimistic
  latestCompletionDate: Date | null    // pessimistic
  uncertaintyDays: number              // range width
  
  // Due date comparison
  dueDate: Date | null
  daysOverdue: number                  // positive = overdue, negative = ahead
  isOverdue: boolean
  
  // Velocity
  velocityPerDay: number               // progress % per day
}

// Calculate estimated completion and uncertainty range
export function calculateEstimatedCompletion(item: Item | ItemNode): EstimationMetrics {
  const now = new Date()
  const startDate = item.startDate ? new Date(item.startDate) : null
  const dueDate = item.dueDate ? new Date(item.dueDate) : null
  const progress = item.progress || 0
  const confidence = item.confidence || 50
  
  // Calculate days spent
  const daysSpent = startDate 
    ? Math.max(0, (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0
  
  // Calculate velocity (progress per day)
  const velocityPerDay = daysSpent > 0 && progress > 0 
    ? progress / daysSpent 
    : 10 // default assumption: 10% per day if no data
  
  // Estimate remaining work
  const remainingProgress = 100 - progress
  const estimatedDaysRemaining = velocityPerDay > 0 
    ? remainingProgress / velocityPerDay 
    : 10 // fallback
  
  const estimatedTotalDays = daysSpent + estimatedDaysRemaining
  
  // Calculate estimated completion date
  const estimatedCompletionDate = new Date(now.getTime() + estimatedDaysRemaining * 24 * 60 * 60 * 1000)
  
  // Uncertainty range based on confidence
  // Low confidence = wide range, high confidence = narrow range
  // uncertainty multiplier: 0% confidence = ±100% of remaining, 100% confidence = ±0%
  const uncertaintyMultiplier = (100 - confidence) / 100
  const uncertaintyDays = estimatedDaysRemaining * uncertaintyMultiplier
  
  const earliestCompletionDate = new Date(estimatedCompletionDate.getTime() - uncertaintyDays * 24 * 60 * 60 * 1000)
  const latestCompletionDate = new Date(estimatedCompletionDate.getTime() + uncertaintyDays * 24 * 60 * 60 * 1000)
  
  // Due date comparison
  let daysOverdue = 0
  let isOverdue = false
  if (dueDate) {
    daysOverdue = (estimatedCompletionDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    isOverdue = daysOverdue > 0
  }
  
  return {
    daysSpent: Math.round(daysSpent * 10) / 10,
    estimatedTotalDays: Math.round(estimatedTotalDays * 10) / 10,
    estimatedDaysRemaining: Math.round(estimatedDaysRemaining * 10) / 10,
    startDate,
    estimatedCompletionDate,
    earliestCompletionDate,
    latestCompletionDate,
    uncertaintyDays: Math.round(uncertaintyDays * 10) / 10,
    dueDate,
    daysOverdue: Math.round(daysOverdue * 10) / 10,
    isOverdue,
    velocityPerDay: Math.round(velocityPerDay * 100) / 100,
  }
}

// Calculate temperature from metrics (hot if overdue, etc)
export function calculateTemperature(item: Item): Item['temperature'] {
  const metrics = calculateEstimatedCompletion(item)
  
  if (metrics.isOverdue && metrics.daysOverdue > 7) return 'critical'
  if (metrics.isOverdue) return 'hot'
  if (metrics.dueDate && metrics.daysOverdue > -3) return 'warm' // due soon
  
  return item.temperature || 'cold'
}
