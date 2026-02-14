import { calculateTemperature } from '../../utils/temperature'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string
  if (!workspaceId) {
    throw createError({ statusCode: 400, statusMessage: 'workspaceId is required' })
  }

  const { user } = await requireWorkspaceMember(event, workspaceId)

  const statusFilter = (query.status as string) || 'active'
  const sort = (query.sort as string) || 'updatedAt'

  // Build status condition
  const statusCondition = statusFilter === 'done'
    ? { status: 'DONE' as const }
    : statusFilter === 'all'
      ? {}
      : { status: { not: 'DONE' as const } }

  // Find all non-root items where user is owner or assignee
  const items = await prisma.item.findMany({
    where: {
      workspaceId,
      parentId: { not: null }, // Exclude root projects
      ...statusCondition,
      OR: [
        { ownerId: user.id },
        { assignees: { some: { userId: user.id } } },
      ],
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      assignees: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      blockedBy: true,
    },
    orderBy: sort === 'dueDate'
      ? { dueDate: 'asc' }
      : sort === 'status'
        ? { status: 'asc' }
        : { updatedAt: 'desc' },
  })

  // Get project info for grouping
  const projectIds = [...new Set(items.map(i => i.projectId).filter(Boolean))] as string[]
  const projects = projectIds.length
    ? await prisma.item.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, title: true, status: true },
      })
    : []
  const projectMap = new Map(projects.map(p => [p.id, p]))

  // Transform items
  const transformedItems = items.map(item => ({
    id: item.id,
    title: item.title,
    status: item.status,
    temperature: calculateTemperature(item),
    progress: item.progress,
    confidence: item.confidence,
    dueDate: item.dueDate,
    startDate: item.startDate,
    updatedAt: item.updatedAt,
    priority: item.priority,
    projectId: item.projectId,
    parentId: item.parentId,
    owner: item.owner,
    assignees: item.assignees.map(a => a.user),
    isBlocked: item.blockedBy.length > 0,
  }))

  // Group by project
  const groupMap = new Map<string, typeof transformedItems>()
  const ungrouped: typeof transformedItems = []

  for (const task of transformedItems) {
    if (task.projectId) {
      const existing = groupMap.get(task.projectId)
      if (existing) {
        existing.push(task)
      } else {
        groupMap.set(task.projectId, [task])
      }
    } else {
      ungrouped.push(task)
    }
  }

  const groups = [...groupMap.entries()].map(([projectId, tasks]) => ({
    project: projectMap.get(projectId) || { id: projectId, title: 'Unknown Project', status: 'TODO' },
    tasks,
  }))

  // Sort groups by most recently updated task
  groups.sort((a, b) => {
    const aLatest = Math.max(...a.tasks.map(t => new Date(t.updatedAt).getTime()))
    const bLatest = Math.max(...b.tasks.map(t => new Date(t.updatedAt).getTime()))
    return bLatest - aLatest
  })

  if (ungrouped.length) {
    groups.push({ project: { id: '', title: 'Other', status: 'TODO' }, tasks: ungrouped })
  }

  const activeCount = transformedItems.filter(t => t.status !== 'DONE').length

  return {
    groups,
    totalCount: transformedItems.length,
    activeCount,
  }
})
