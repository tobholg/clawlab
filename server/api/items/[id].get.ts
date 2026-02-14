import { prisma } from '../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../utils/auth'
import { calculateTemperature } from '../../utils/temperature'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  await requireWorkspaceMemberForItem(event, id)

  const item = await prisma.item.findUnique({
    where: { id },
    include: {
      owner: true,
      assignees: { include: { user: true } },
      stakeholders: { include: { user: true } },
      blockedBy: { include: { blockingItem: true } },
      blocks: { include: { blockedItem: true } },
      parent: true,
      _count: { select: { documents: true } },
      children: {
        include: {
          owner: true,
          assignees: { include: { user: true } },
          children: true,
          blockedBy: true,
        }
      },
      comments: {
        where: { parentCommentId: null },
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          replies: {
            orderBy: { createdAt: 'asc' },
            include: { user: true }
          }
        }
      }
    }
  })
  
  if (!item) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }
  
  // Build breadcrumb path
  const breadcrumbs = await buildBreadcrumbs(item.id)
  
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    parentId: item.parentId,
    workspaceId: item.workspaceId,
    status: item.status.toLowerCase(),
    subStatus: item.subStatus ?? null,
    category: item.category,
    complexity: item.complexity ?? null,
    priority: item.priority ?? null,
    dueDate: item.dueDate?.toISOString() ?? null,
    startDate: item.startDate?.toISOString() ?? null,
    confidence: item.confidence,
    progress: item.progress,
    temperature: calculateTemperature(item),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    lastActivityAt: item.lastActivityAt.toISOString(),
    owner: item.owner ? {
      id: item.owner.id,
      name: item.owner.name,
      avatar: item.owner.avatar,
    } : null,
    // Legacy assignee field - use owner instead
    assignee: item.owner ? {
      id: item.owner.id,
      name: item.owner.name,
      avatar: item.owner.avatar,
    } : null,
    assignees: item.assignees.map(a => ({
      id: a.user.id,
      name: a.user.name,
      avatar: a.user.avatar,
    })),
    stakeholders: item.stakeholders.map(s => ({
      id: s.user.id,
      name: s.user.name,
      avatar: s.user.avatar,
    })),
    blockedBy: item.blockedBy.map(d => ({
      id: d.blockingItem.id,
      title: d.blockingItem.title,
    })),
    blocks: item.blocks.map(d => ({
      id: d.blockedItem.id,
      title: d.blockedItem.title,
    })),
    childrenCount: item.children.length,
    documentCount: item._count?.documents ?? 0,
    children: item.children.map(child => ({
      id: child.id,
      title: child.title,
      status: child.status.toLowerCase(),
      progress: child.progress,
      confidence: child.confidence,
      dueDate: child.dueDate?.toISOString() ?? null,
      owner: child.owner ? {
        id: child.owner.id,
        name: child.owner.name,
        avatar: child.owner.avatar,
      } : null,
      assignee: child.owner ? {
        id: child.owner.id,
        name: child.owner.name,
        avatar: child.owner.avatar,
      } : null,
      childrenCount: child.children.length,
      isBlocked: child.blockedBy.length > 0,
    })),
    breadcrumbs,
    parent: item.parent ? {
      id: item.parent.id,
      title: item.parent.title,
      parentId: item.parent.parentId,
      status: item.parent.status.toLowerCase(),
      progress: item.parent.progress,
      childrenCount: 0, // We'd need another query for this
    } : null,
    comments: item.comments.map(c => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      user: c.user ? {
        id: c.user.id,
        name: c.user.name ?? c.user.email.split('@')[0],
        avatar: c.user.avatar,
      } : null,
      replies: c.replies.map(r => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        user: r.user ? {
          id: r.user.id,
          name: r.user.name ?? r.user.email.split('@')[0],
          avatar: r.user.avatar,
        } : null,
      })),
    })),
  }
})

async function buildBreadcrumbs(itemId: string): Promise<Array<{ id: string; title: string }>> {
  const path: Array<{ id: string; title: string }> = []
  let currentId: string | null = itemId
  
  while (currentId) {
    const item = await prisma.item.findUnique({
      where: { id: currentId },
      select: { id: true, title: true, parentId: true }
    })
    if (!item) break
    path.unshift({ id: item.id, title: item.title })
    currentId = item.parentId
  }
  
  return path
}
