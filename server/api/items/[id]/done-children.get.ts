import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../../utils/auth'
import { calculateTemperature } from '../../../utils/temperature'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const query = getQuery(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  await requireWorkspaceMemberForItem(event, id)

  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20))
  const period = (query.period as string) || 'all'
  const search = (query.search as string) || ''
  const sort = (query.sort as string) || 'newest'

  // Build where clause
  const where: any = {
    parentId: id,
    status: 'DONE',
  }

  // Period filter (use completedAt when available, fall back to updatedAt)
  if (period === '7d') {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    where.OR = [
      { completedAt: { gte: cutoff } },
      { completedAt: null, updatedAt: { gte: cutoff } },
    ]
  } else if (period === '30d') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    where.OR = [
      { completedAt: { gte: cutoff } },
      { completedAt: null, updatedAt: { gte: cutoff } },
    ]
  }

  // Search filter
  if (search.trim()) {
    where.title = { contains: search.trim(), mode: 'insensitive' }
  }

  // Order by (prefer completedAt, fall back to updatedAt)
  let orderBy: any
  switch (sort) {
    case 'oldest':
      orderBy = [{ completedAt: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'asc' }]
      break
    case 'title':
      orderBy = { title: 'asc' }
      break
    case 'newest':
    default:
      orderBy = [{ completedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }]
      break
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        owner: {
          select: { id: true, name: true, avatar: true },
        },
        assignees: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
        },
        _count: { select: { documents: true, children: true } },
      },
    }),
    prisma.item.count({ where }),
  ])

  return {
    items: items.map(item => ({
      id: item.id,
      title: item.title,
      description: item.description,
      parentId: item.parentId,
      status: item.status.toLowerCase(),
      category: item.category,
      complexity: item.complexity ?? null,
      priority: item.priority ?? null,
      progress: item.progress ?? 0,
      confidence: item.confidence,
      temperature: calculateTemperature(item),
      dueDate: item.dueDate?.toISOString() ?? null,
      createdAt: item.createdAt?.toISOString() ?? null,
      updatedAt: item.updatedAt?.toISOString() ?? null,
      completedAt: item.completedAt?.toISOString() ?? item.updatedAt?.toISOString() ?? null,
      owner: item.owner ? {
        id: item.owner.id,
        name: item.owner.name,
        avatar: item.owner.avatar,
      } : null,
      assignees: item.assignees?.map((a: any) => ({
        id: a.user.id,
        name: a.user.name,
        avatar: a.user.avatar,
      })) ?? [],
      childrenCount: item._count?.children ?? 0,
      documentCount: item._count?.documents ?? 0,
    })),
    total,
    page,
    pageSize,
  }
})
