<script setup lang="ts">
import { getItemEstimateMeta } from '~/utils/itemRisk'
import type { ItemNode, Item } from '~/types'
import { STATUS_CONFIG, SUB_STATUS_CONFIG, getSubStatusesForStatus } from '~/types'

type BoardColumnKey = 'todo' | 'in_progress' | 'blocked'
type BoardColumnGroup = {
  key: string
  label: string | null
  icon: string | null
  subStatus: string | null
  targetStatus: Item['status']
  items: ItemNode[]
}

const props = defineProps<{
  items: ItemNode[]
  archiveCount?: number
  parentItemId?: string
  tab?: 'tasks' | 'archive'
}>()

const emit = defineEmits<{
  openDetail: [item: ItemNode]
  drillDown: [item: ItemNode]
  openAttention: [item: ItemNode, mode: 'at-risk' | 'blocked']
  openDocs: [item: ItemNode]
  openArchive: []
  statusChange: [itemId: string, newStatus: string, newSubStatus?: string | null]
}>()

const collapsedSections = ref<Set<string>>(new Set())
const draggedItemId = ref<string | null>(null)
const dragTargetColumnKey = ref<BoardColumnKey | null>(null)
const dragTargetGroupKey = ref<string | null>(null)

const priorityOrder: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

const temperatureOrder: Record<string, number> = {
  critical: 0,
  hot: 1,
  warm: 2,
  cold: 3,
}

const statusIcons: Record<Item['status'], string> = {
  todo: 'heroicons:queue-list',
  in_progress: 'heroicons:play',
  blocked: 'heroicons:lock-closed',
  paused: 'heroicons:pause',
  done: 'heroicons:check-circle',
}

const boardColumns: Array<{
  key: BoardColumnKey
  label: string
  dot: string
  bodyTint: string
  groupText: string
  statuses: Item['status'][]
}> = [
  {
    key: 'todo',
    label: 'To do',
    dot: 'bg-slate-400',
    bodyTint: 'bg-slate-50 dark:bg-white/[0.025]',
    groupText: 'text-slate-500 dark:text-zinc-400',
    statuses: ['todo'],
  },
  {
    key: 'in_progress',
    label: 'In progress',
    dot: 'bg-emerald-400',
    bodyTint: 'bg-slate-50 dark:bg-white/[0.025]',
    groupText: 'text-slate-500 dark:text-zinc-400',
    statuses: ['in_progress', 'paused'],
  },
  {
    key: 'blocked',
    label: 'Blocked',
    dot: 'bg-rose-400',
    bodyTint: 'bg-slate-50 dark:bg-white/[0.025]',
    groupText: 'text-slate-500 dark:text-zinc-400',
    statuses: ['blocked'],
  },
]

const activeItems = computed(() => props.items.filter(item => item.status !== 'done'))

const itemsByColumn = computed(() => {
  return boardColumns.map((column) => {
    const items = getColumnItems(column)
    return {
      ...column,
      items,
      groups: getColumnGroups(column, items),
    }
  })
})

const archivedItems = computed(() => {
  return [...props.items]
    .filter(item => item.status === 'done')
    .sort((a, b) => getActivityTime(b) - getActivityTime(a))
})

const activeTab = computed(() => props.tab ?? 'tasks')
const pausedSubStatuses = new Set(Object.keys(getSubStatusesForStatus('paused')))

watch(itemsByColumn, (columns) => {
  const validKeys = new Set(columns.flatMap(column => column.groups.map(group => group.key)))
  const next = new Set([...collapsedSections.value].filter(key => validKeys.has(key)))
  if (next.size !== collapsedSections.value.size) {
    collapsedSections.value = next
  }
}, { deep: true })

function sortItems(a: ItemNode, b: ItemNode) {
  const priorityDiff = (priorityOrder[a.priority ?? 'MEDIUM'] ?? 99) - (priorityOrder[b.priority ?? 'MEDIUM'] ?? 99)
  if (priorityDiff !== 0) return priorityDiff

  const temperatureDiff = (temperatureOrder[a.temperature] ?? 99) - (temperatureOrder[b.temperature] ?? 99)
  if (temperatureDiff !== 0) return temperatureDiff

  const riskDiff = (b.blockedChildrenCount ?? 0) + (b.atRiskChildrenCount ?? 0) - ((a.blockedChildrenCount ?? 0) + (a.atRiskChildrenCount ?? 0))
  if (riskDiff !== 0) return riskDiff

  const activityDiff = getActivityTime(b) - getActivityTime(a)
  if (activityDiff !== 0) return activityDiff

  return a.title.localeCompare(b.title)
}

function getActivityTime(item: ItemNode) {
  return new Date(item.lastActivityAt || item.updatedAt || item.createdAt || 0).getTime()
}

function getColumnItems(column: typeof boardColumns[number]) {
  return [...activeItems.value]
    .filter(item => column.statuses.includes(item.status))
    .sort(sortItems)
}

function getColumnSubStatuses(column: typeof boardColumns[number]) {
  if (column.key === 'in_progress') {
    return {
      ...getSubStatusesForStatus('in_progress'),
      ...getSubStatusesForStatus('paused'),
    }
  }

  return getSubStatusesForStatus(column.key)
}

function getColumnGroups(column: typeof boardColumns[number], items: ItemNode[]): BoardColumnGroup[] {
  const subStatusMap = getColumnSubStatuses(column)
  const subStatusKeys = Object.keys(subStatusMap)

  if (!subStatusKeys.length) {
    return [{ key: `${column.key}:all`, label: null, icon: null, subStatus: null, targetStatus: column.key, items }]
  }

  const groups: BoardColumnGroup[] = []
  const sortedSubStatuses = subStatusKeys.sort((a, b) => {
    const configA = subStatusMap[a as keyof typeof subStatusMap]
    const configB = subStatusMap[b as keyof typeof subStatusMap]
    return (configA?.order ?? 99) - (configB?.order ?? 99)
  })

  for (const subStatus of sortedSubStatuses) {
    const groupItems = items.filter(item => item.subStatus === subStatus)
    if (!groupItems.length) continue

    const config = subStatusMap[subStatus as keyof typeof subStatusMap]
    groups.push({
      key: `${column.key}:${subStatus}`,
      label: config?.label ?? subStatus,
      icon: config?.icon ?? null,
      subStatus,
      targetStatus: resolveStatusForGroup(column.key, subStatus),
      items: groupItems,
    })
  }

  const defaultItems = items.filter(item => !item.subStatus || !subStatusKeys.includes(item.subStatus))
  if (defaultItems.length) {
    groups.unshift({
      key: `${column.key}:default`,
      label: groups.length ? 'Unsorted' : null,
      icon: groups.length ? 'heroicons:inbox-stack' : null,
      subStatus: null,
      targetStatus: column.key,
      items: defaultItems,
    })
  }

  return groups
}

function toggleSection(sectionKey: string) {
  const next = new Set(collapsedSections.value)
  if (next.has(sectionKey)) {
    next.delete(sectionKey)
  } else {
    next.add(sectionKey)
  }
  collapsedSections.value = next
}

function isSectionCollapsed(sectionKey: string) {
  return collapsedSections.value.has(sectionKey)
}

function resolveStatusForGroup(columnKey: BoardColumnKey, subStatus: string | null) {
  if (columnKey === 'in_progress' && subStatus && pausedSubStatuses.has(subStatus)) {
    return 'paused'
  }
  return columnKey
}

function handleDragStart(event: DragEvent, item: ItemNode) {
  draggedItemId.value = item.id
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', item.id)
  }
}

function clearDragState() {
  draggedItemId.value = null
  dragTargetColumnKey.value = null
  dragTargetGroupKey.value = null
}

function handleDragEnd() {
  clearDragState()
}

function handleColumnDragOver(event: DragEvent, columnKey: BoardColumnKey) {
  if (!draggedItemId.value) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dragTargetColumnKey.value = columnKey
  dragTargetGroupKey.value = null
}

function handleGroupDragOver(event: DragEvent, columnKey: BoardColumnKey, groupKey: string) {
  if (!draggedItemId.value) return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dragTargetColumnKey.value = columnKey
  dragTargetGroupKey.value = groupKey
}

function handleColumnDrop(event: DragEvent, column: typeof boardColumns[number]) {
  event.preventDefault()
  if (!draggedItemId.value) return
  const item = props.items.find(candidate => candidate.id === draggedItemId.value)
  if (!item) {
    clearDragState()
    return
  }

  if (item.status !== column.key || item.subStatus !== null) {
    emit('statusChange', item.id, column.key, null)
  }
  clearDragState()
}

function handleGroupDrop(event: DragEvent, group: BoardColumnGroup) {
  event.preventDefault()
  if (!draggedItemId.value) return
  const item = props.items.find(candidate => candidate.id === draggedItemId.value)
  if (!item) {
    clearDragState()
    return
  }

  if (item.status !== group.targetStatus || item.subStatus !== group.subStatus) {
    emit('statusChange', item.id, group.targetStatus, group.subStatus)
  }
  clearDragState()
}

function formatRelativeDate(dateStr?: string | null) {
  if (!dateStr) return 'No activity yet'

  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  if (diffHours < 24) return `${diffHours} hr ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} wk ago`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getOwnerLabel(item: ItemNode) {
  if (item.owner?.name) return item.owner.name
  if (item.assignees?.length) return item.assignees[0]?.name || 'Assigned'
  return 'Unassigned'
}

function getItemMeta(item: ItemNode) {
  const parts = [formatRelativeDate(item.lastActivityAt || item.updatedAt || item.createdAt), getOwnerLabel(item)]
  if (item.category) parts.push(item.category)
  return parts
}

function getStateBadge(item: ItemNode) {
  if (item.agentMode === 'EXECUTE') {
    return {
      label: 'Executing',
      icon: 'heroicons:bolt',
      classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    }
  }

  if (item.agentMode === 'PLAN' && item.planDocId) {
    return {
      label: 'Plan ready',
      icon: 'heroicons:clipboard-document-list',
      classes: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    }
  }

  if (item.agentMode === 'PLAN') {
    return {
      label: 'Planning',
      icon: 'heroicons:clock',
      classes: 'bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-zinc-400',
    }
  }

  if (item.subStatus && SUB_STATUS_CONFIG[item.subStatus]) {
    const config = SUB_STATUS_CONFIG[item.subStatus]
    return {
      label: config.label,
      icon: config.icon,
      classes: config.color,
    }
  }

  const config = STATUS_CONFIG[item.status]
  return {
    label: config.label,
    icon: statusIcons[item.status],
    classes: config.color,
  }
}

function getStateBadgeClasses(item: ItemNode) {
  return getStateBadge(item).classes
    .split(' ')
    .filter(token => !token.startsWith('bg-') && !token.startsWith('dark:bg-'))
    .join(' ')
}

function getMetric(item: ItemNode) {
  const progress = Math.max(0, Math.min(100, item.progress ?? 0))
  return {
    value: `${progress}%`,
    label: '',
    classes: progress > 0
      ? 'text-emerald-500 dark:text-emerald-400'
      : 'text-slate-400 dark:text-zinc-500',
  }
}

function getTrailingNote(item: ItemNode) {
  const estimatedCompletion = getEstimatedCompletion(item)
  if (estimatedCompletion && !estimatedCompletion.complete) {
    return estimatedCompletion.isExact
      ? estimatedCompletion.baseDate
      : `${estimatedCompletion.earliest} - ${estimatedCompletion.latest}`
  }

  if (item.dueDate) {
    return `Due ${new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }

  if ((item.childrenCount ?? 0) > 0) {
    return `${item.activeChildrenCount ?? item.childrenCount ?? 0} open`
  }

  return formatRelativeDate(item.lastActivityAt || item.updatedAt || item.createdAt)
}

function getTrailingNoteClasses(item: ItemNode) {
  const estimatedCompletion = getEstimatedCompletion(item)
  if (estimatedCompletion && !estimatedCompletion.complete) {
    const meta = getItemEstimateMeta(item)
    if (meta.missProb >= 66) return 'text-rose-500 dark:text-rose-400'
    if (meta.missProb >= 33) return 'text-amber-500 dark:text-amber-400'
    return item.dueDate ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-500'
  }

  return 'text-slate-400 dark:text-zinc-500'
}

function getEstimatedCompletion(item: ItemNode) {
  const progress = item.progress ?? 0
  const confidence = item.confidence ?? 70
  const startDate = item.startDate

  if (!startDate || progress === 0) return null

  const start = new Date(startDate)
  const now = new Date()
  const daysSpent = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))

  if (progress >= 100) return { complete: true }

  const totalEstimate = Math.round(daysSpent / (progress / 100))
  const remainingDays = Math.max(1, totalEstimate - daysSpent)

  const baseDate = new Date()
  baseDate.setDate(baseDate.getDate() + remainingDays)

  const bandDays = Math.ceil(remainingDays * (1 - confidence / 100) * 2)

  const earliest = new Date(baseDate)
  earliest.setDate(earliest.getDate() - Math.floor(bandDays / 2))
  const latest = new Date(baseDate)
  latest.setDate(latest.getDate() + Math.ceil(bandDays / 2))

  const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return {
    complete: false,
    earliest: formatDate(earliest),
    latest: formatDate(latest),
    isExact: confidence >= 95,
    baseDate: formatDate(baseDate),
  }
}

function getToneDot(item: ItemNode) {
  if (item.status === 'blocked' || (item.blockedChildrenCount ?? 0) > 0) return 'bg-rose-400'
  if ((item.atRiskChildrenCount ?? 0) > 0 || item.temperature === 'critical') return 'bg-amber-400'
  if (item.status === 'in_progress' || item.agentMode === 'EXECUTE') return 'bg-emerald-400'
  if (item.status === 'paused') return 'bg-amber-300'
  return 'bg-slate-300 dark:bg-zinc-600'
}
</script>

<template>
  <section class="flex h-full min-h-0 w-full flex-col">
    <div v-if="activeTab === 'tasks'" class="grid flex-1 min-h-0 gap-4 overflow-hidden xl:grid-cols-3">
      <section
        v-for="column in itemsByColumn"
        :key="column.key"
        class="flex min-w-0 min-h-0 flex-col rounded-2xl"
      >
        <div class="mb-2 flex items-start justify-between gap-3 px-1">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full" :class="column.dot" />
              <h3 class="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                {{ column.label }}
              </h3>
            </div>
          </div>
          <span class="rounded-full bg-white/80 px-2 py-1 text-[11px] font-medium text-slate-500 dark:bg-white/[0.05] dark:text-zinc-300">
            {{ column.items.length }}
          </span>
        </div>

        <div
          class="flex min-h-0 flex-1 flex-col rounded-2xl p-3 transition-colors"
          :class="[
            column.bodyTint,
            dragTargetColumnKey === column.key && !dragTargetGroupKey ? 'ring-1 ring-inset ring-slate-300/80 dark:ring-white/[0.10]' : '',
          ]"
          @dragover="handleColumnDragOver($event, column.key)"
          @drop="handleColumnDrop($event, column)"
        >
          <div v-if="column.items.length" class="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            <section
              v-for="group in column.groups"
              :key="group.key"
              class="relative"
            >
              <button
                v-if="group.label"
                class="mb-2 flex w-full items-center gap-1.5 rounded-lg bg-white/70 px-2 py-1.5 text-left text-[11px] font-medium transition-colors hover:bg-white/90 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
                :class="dragTargetGroupKey === group.key ? 'ring-1 ring-inset ring-slate-300/80 dark:ring-white/[0.12]' : ''"
                @click="toggleSection(group.key)"
                @dragover="handleGroupDragOver($event, column.key, group.key)"
                @drop.stop="handleGroupDrop($event, group)"
              >
                <Icon
                  name="heroicons:chevron-right"
                  class="h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-transform duration-200 dark:text-zinc-500"
                  :class="{ 'rotate-90': !isSectionCollapsed(group.key) }"
                />
                <span class="inline-flex h-4 w-4 items-center justify-center leading-none" :class="column.groupText">
                  <Icon v-if="group.icon" :name="group.icon" class="h-3 w-3" />
                </span>
                <span class="flex-1" :class="column.groupText">{{ group.label }}</span>
                <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-white/[0.06] dark:text-zinc-500">
                  {{ group.items.length }}
                </span>
              </button>

              <div
                v-show="!group.label || !isSectionCollapsed(group.key)"
                class="flex flex-col gap-2 rounded-xl transition-colors"
                :class="dragTargetGroupKey === group.key ? 'bg-white/45 dark:bg-white/[0.03]' : ''"
                @dragover="handleGroupDragOver($event, column.key, group.key)"
                @drop.stop="handleGroupDrop($event, group)"
              >
                <button
                  v-for="item in group.items"
                  :key="item.id"
                  draggable="true"
                  class="group w-full rounded-xl border border-slate-200/60 bg-white px-4 py-3.5 text-left transition-all duration-200 ease-in-out hover:border-slate-300/70 dark:border-white/[0.035] dark:bg-white/[0.05] dark:hover:border-white/[0.07] dark:hover:bg-white/[0.07]"
                  :class="draggedItemId === item.id ? 'cursor-grabbing opacity-55' : 'cursor-grab active:cursor-grabbing'"
                  @dragstart="handleDragStart($event, item)"
                  @dragend="handleDragEnd"
                  @click="emit('openDetail', item)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-start gap-2">
                        <span class="mt-[5px] h-2 w-2 flex-shrink-0 rounded-full" :class="getToneDot(item)" />
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-[14px] font-medium leading-5 text-slate-900 dark:text-zinc-100">
                            {{ item.title }}
                          </p>
                          <div class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-slate-500 dark:text-zinc-400">
                            <template v-for="(part, index) in getItemMeta(item)" :key="`${item.id}-${part}`">
                              <span>{{ part }}</span>
                              <span v-if="index < getItemMeta(item).length - 1" class="text-slate-300 dark:text-zinc-600">&middot;</span>
                            </template>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="min-w-[56px] flex-shrink-0 text-right">
                    <div class="text-[18px] font-semibold leading-none tracking-tight" :class="getMetric(item).classes">
                      {{ getMetric(item).value }}
                    </div>
                    <div
                      v-if="getMetric(item).label"
                      class="mt-1 text-[9px] font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500"
                    >
                      {{ getMetric(item).label }}
                    </div>
                  </div>
                </div>

                  <div class="mt-3.5 flex items-center justify-between gap-2">
                    <span
                      class="inline-flex items-center gap-1 text-[11px] font-medium"
                      :class="getStateBadgeClasses(item)"
                    >
                      <span class="inline-flex h-4 w-4 items-center justify-center leading-none">
                        <Icon :name="getStateBadge(item).icon" class="h-3 w-3" />
                      </span>
                      <span>{{ getStateBadge(item).label }}</span>
                    </span>

                    <div class="flex items-center gap-2">
                      <span class="text-[11px]" :class="getTrailingNoteClasses(item)">
                        {{ getTrailingNote(item) }}
                      </span>
                      <button
                        v-if="(item.childrenCount ?? 0) > 0"
                        class="inline-flex items-center gap-0.5 text-[11px] text-slate-500 transition-colors hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        @click.stop="emit('drillDown', item)"
                      >
                        <Icon name="heroicons:arrows-pointing-out" class="h-3.5 w-3.5" />
                        <span>{{ item.activeChildrenCount ?? item.childrenCount }}</span>
                      </button>

                      <button
                        v-if="item.documentCount"
                        class="inline-flex items-center gap-0.5 text-[11px] text-slate-500 transition-colors hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                        @click.stop="emit('openDocs', item)"
                      >
                        <Icon name="heroicons:document-text" class="h-3.5 w-3.5" />
                        <span>{{ item.documentCount }}</span>
                      </button>

                      <button
                        v-if="(item.atRiskChildrenCount ?? 0) > 0"
                        class="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-amber-700 transition-colors hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10"
                        @click.stop="emit('openAttention', item, 'at-risk')"
                      >
                        <span class="inline-flex h-5 w-5 items-center justify-center leading-none rounded-full bg-amber-100 dark:bg-amber-500/15">
                          <Icon name="heroicons:exclamation-triangle" class="h-3.5 w-3.5" />
                        </span>
                        <span>{{ item.atRiskChildrenCount }}</span>
                      </button>

                      <button
                        v-if="(item.blockedChildrenCount ?? 0) > 0"
                        class="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-rose-700 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        @click.stop="emit('openAttention', item, 'blocked')"
                      >
                        <span class="inline-flex h-5 w-5 items-center justify-center leading-none rounded-full bg-rose-100 dark:bg-rose-500/15">
                          <Icon name="heroicons:lock-closed" class="h-3.5 w-3.5" />
                        </span>
                        <span>{{ item.blockedChildrenCount }}</span>
                      </button>
                    </div>
                  </div>
                </button>
              </div>
            </section>
          </div>

          <div
            v-else
            class="flex min-h-[220px] flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200/80 text-center text-sm text-slate-400 transition-colors dark:border-white/[0.08] dark:text-zinc-500"
            :class="dragTargetColumnKey === column.key && !dragTargetGroupKey ? 'border-slate-300 bg-white/50 dark:border-white/[0.12] dark:bg-white/[0.04]' : ''"
          >
            No items
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="archivedItems.length" class="flex-1 min-h-0 overflow-auto divide-y divide-slate-200/70 dark:divide-white/[0.08]">
      <button
        v-for="item in archivedItems"
        :key="item.id"
        class="group flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
        @click="emit('openDetail', item)"
      >
        <span class="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-emerald-500" />

        <div class="min-w-0 flex-1">
          <p class="truncate text-[15px] font-medium text-slate-900 dark:text-zinc-100">
            {{ item.title }}
          </p>
          <div class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px] text-slate-500 dark:text-zinc-400">
            <span>{{ formatRelativeDate(item.lastActivityAt || item.updatedAt || item.createdAt) }}</span>
            <span class="text-slate-300 dark:text-zinc-600">&middot;</span>
            <span>{{ getOwnerLabel(item) }}</span>
            <template v-if="item.category">
              <span class="text-slate-300 dark:text-zinc-600">&middot;</span>
              <span>{{ item.category }}</span>
            </template>
          </div>
        </div>

        <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <span class="inline-flex h-5 w-5 items-center justify-center leading-none">
            <Icon name="heroicons:check-circle" class="h-3.5 w-3.5" />
          </span>
          <span>Done</span>
        </span>
      </button>
    </div>

    <div v-else class="flex flex-1 min-h-[320px] items-center justify-center rounded-2xl bg-slate-50/70 text-center dark:bg-white/[0.02]">
      <div class="flex max-w-sm flex-col items-center gap-2 px-6">
        <div class="rounded-full bg-white p-3 dark:bg-white/[0.04]">
          <Icon
            :name="activeTab === 'tasks' ? 'heroicons:queue-list' : 'heroicons:archive-box'"
            class="h-5 w-5 text-slate-400 dark:text-zinc-500"
          />
        </div>
        <p class="text-sm font-medium text-slate-700 dark:text-zinc-200">
          {{ activeTab === 'tasks' ? 'No active items match the current filters.' : 'No recent completed items to show here.' }}
        </p>
        <p class="text-sm text-slate-500 dark:text-zinc-400">
          {{ activeTab === 'tasks' ? 'Adjust the filters or create a new item.' : 'Older completed work is still available in the full archive.' }}
        </p>
        <button
          v-if="activeTab === 'archive' && parentItemId"
          class="mt-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-white/[0.08] dark:text-zinc-300 dark:hover:border-white/[0.14] dark:hover:text-zinc-100"
          @click="emit('openArchive')"
        >
          Open full archive
        </button>
      </div>
    </div>
  </section>
</template>
