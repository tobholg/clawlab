export type ItemStatusValue = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'PAUSED' | 'DONE'

export const VALID_SUB_STATUS_BY_STATUS: Record<ItemStatusValue, string[]> = {
  TODO: ['backlog', 'ready'],
  IN_PROGRESS: ['scoping', 'active', 'review', 'finalizing'],
  BLOCKED: ['dependency', 'external', 'decision'],
  PAUSED: ['on_hold', 'deprioritized'],
  DONE: [],
}

export const DEFAULT_SUB_STATUS_BY_STATUS: Record<ItemStatusValue, string | null> = {
  TODO: 'backlog',
  IN_PROGRESS: 'scoping',
  BLOCKED: 'dependency',
  PAUSED: 'on_hold',
  DONE: null,
}

const ITEM_STATUSES = new Set<ItemStatusValue>([
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'PAUSED',
  'DONE',
])

export function normalizeItemStatus(value: unknown, fallback: ItemStatusValue = 'TODO'): ItemStatusValue {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toUpperCase() as ItemStatusValue
  return ITEM_STATUSES.has(normalized) ? normalized : fallback
}

export function getDefaultSubStatus(status: ItemStatusValue): string | null {
  return DEFAULT_SUB_STATUS_BY_STATUS[status]
}

export function isValidSubStatusForStatus(status: ItemStatusValue, subStatus: string | null | undefined): boolean {
  if (!subStatus) {
    return status === 'TODO' || status === 'DONE'
  }
  return VALID_SUB_STATUS_BY_STATUS[status].includes(subStatus)
}

export function normalizeIncomingSubStatus(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

