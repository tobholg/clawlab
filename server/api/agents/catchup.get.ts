import { prisma } from '../../utils/prisma'
import { requireTokenUser } from '../../utils/agentApi'

const DEFAULT_SINCE = '4h'
const MAX_RESULTS_PER_SECTION = 50

function parseSince(value: string): Date {
  // Try ISO date first
  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) return direct

  // Relative: 30m, 2h, 7d, 1w
  const match = value.trim().toLowerCase().match(/^(\d+)([smhdw])$/)
  if (!match) {
    throw createError({ statusCode: 400, message: 'Invalid since format. Use ISO datetime or relative values like 30m, 2h, 7d' })
  }

  const amount = parseInt(match[1], 10)
  const unit = match[2]
  const unitMs: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  }

  return new Date(Date.now() - amount * unitMs[unit])
}

export default defineEventHandler(async (event) => {
  const agent = await requireTokenUser(event)
  const query = getQuery(event)
  const sinceParam = typeof query.since === 'string' ? query.since : DEFAULT_SINCE
  const refreshRequested = query.refresh === 'true' || query.refresh === '1'
  const since = parseSince(sinceParam)

  // 1. Tasks assigned to agent that were created since `since`
  const assignedTasks = await prisma.item.findMany({
    where: {
      assignees: { some: { userId: agent.id } },
      createdAt: { gte: since },
    },
    select: {
      id: true,
      title: true,
      status: true,
      subStatus: true,
      agentMode: true,
      priority: true,
      projectId: true,
      parentId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_RESULTS_PER_SECTION,
  })

  // 2. Tasks agent is assigned to that were updated (but not created) since `since`
  const updatedTasks = await prisma.item.findMany({
    where: {
      assignees: { some: { userId: agent.id } },
      updatedAt: { gte: since },
      createdAt: { lt: since },
    },
    select: {
      id: true,
      title: true,
      status: true,
      subStatus: true,
      agentMode: true,
      priority: true,
      projectId: true,
      parentId: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_RESULTS_PER_SECTION,
  })

  // 3. New comments on agent's tasks
  const commentedTasks = await prisma.comment.findMany({
    where: {
      createdAt: { gte: since },
      userId: { not: agent.id }, // Exclude agent's own comments
      item: {
        assignees: { some: { userId: agent.id } },
      },
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: {
        select: { id: true, name: true, avatar: true },
      },
      item: {
        select: { id: true, title: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_RESULTS_PER_SECTION,
  })

  // 4. Channel messages where agent was @mentioned
  const mentions = await prisma.messageMention.findMany({
    where: {
      userId: agent.id,
      message: {
        createdAt: { gte: since },
        deleted: false,
        userId: { not: agent.id },
      },
    },
    select: {
      message: {
        select: {
          id: true,
          channelId: true,
          content: true,
          parentId: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, avatar: true, isAgent: true },
          },
          channel: {
            select: { id: true, name: true, displayName: true },
          },
        },
      },
    },
    orderBy: { message: { createdAt: 'desc' } },
    take: MAX_RESULTS_PER_SECTION,
  })

  // 5. Replies to threads agent participated in
  // Find threads where the agent has posted, then get new replies by others
  const agentThreadParentIds = await prisma.message.findMany({
    where: {
      userId: agent.id,
      parentId: { not: null },
      deleted: false,
    },
    select: { parentId: true },
    distinct: ['parentId'],
  })

  const threadParentIds = agentThreadParentIds
    .map((m) => m.parentId)
    .filter((id): id is string => id !== null)

  // Also include threads where the agent posted the parent message
  const agentParentMessages = await prisma.message.findMany({
    where: {
      userId: agent.id,
      parentId: null,
      deleted: false,
      replies: { some: {} },
    },
    select: { id: true },
  })

  const allThreadIds = [...new Set([...threadParentIds, ...agentParentMessages.map((m) => m.id)])]

  let threadReplies: any[] = []
  if (allThreadIds.length > 0) {
    threadReplies = await prisma.message.findMany({
      where: {
        parentId: { in: allThreadIds },
        createdAt: { gte: since },
        deleted: false,
        userId: { not: agent.id },
      },
      select: {
        id: true,
        channelId: true,
        parentId: true,
        content: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, avatar: true, isAgent: true },
        },
        channel: {
          select: { id: true, name: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_RESULTS_PER_SECTION,
    })
  }

  const channelMentions = mentions.map((m) => ({
    id: m.message.id,
    channelId: m.message.channelId,
    channelName: m.message.channel.displayName || m.message.channel.name,
    content: m.message.content,
    threadId: m.message.parentId,
    author: m.message.user,
    createdAt: m.message.createdAt.toISOString(),
  }))

  // Build breadcrumbs for all tasks (project > parent > task)
  const allTaskItems = [...assignedTasks, ...updatedTasks]
  const parentIds = new Set<string>()
  for (const t of allTaskItems) {
    if (t.parentId) parentIds.add(t.parentId)
    if (t.projectId) parentIds.add(t.projectId)
  }
  // Remove ids we already have
  for (const t of allTaskItems) parentIds.delete(t.id)

  const ancestorMap = new Map<string, { id: string; title: string; parentId: string | null }>()
  if (parentIds.size > 0) {
    const ancestors = await prisma.item.findMany({
      where: { id: { in: [...parentIds] } },
      select: { id: true, title: true, parentId: true },
    })
    for (const a of ancestors) ancestorMap.set(a.id, a)
    // Fetch one more level up for grandparents
    const grandparentIds = new Set<string>()
    for (const a of ancestors) {
      if (a.parentId && !ancestorMap.has(a.parentId) && !allTaskItems.some(t => t.id === a.parentId)) {
        grandparentIds.add(a.parentId)
      }
    }
    if (grandparentIds.size > 0) {
      const grandparents = await prisma.item.findMany({
        where: { id: { in: [...grandparentIds] } },
        select: { id: true, title: true, parentId: true },
      })
      for (const g of grandparents) ancestorMap.set(g.id, g)
    }
  }

  function getBreadcrumb(task: { id: string; parentId: string | null; projectId: string | null }): string[] {
    const crumbs: string[] = []
    let currentId = task.parentId
    const visited = new Set<string>()
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      const ancestor = ancestorMap.get(currentId)
      if (ancestor) {
        crumbs.unshift(ancestor.title)
        currentId = ancestor.parentId
      } else {
        break
      }
    }
    return crumbs
  }

  const isActionableTask = (task: { status: string; subStatus: string | null; agentMode: string | null }) => {
    if (!task.agentMode) return false
    if (String(task.status || '').toUpperCase() === 'DONE') return false
    return String(task.subStatus || '').toLowerCase() !== 'review'
  }

  const actionableTaskCount = [...assignedTasks, ...updatedTasks].filter(isActionableTask).length

  return {
    generatedAt: new Date().toISOString(),
    refreshRequested,
    since: since.toISOString(),
    tasks: {
      assigned: assignedTasks.map((t) => ({
        ...t,
        breadcrumb: getBreadcrumb(t),
        createdAt: t.createdAt.toISOString(),
      })),
      updated: updatedTasks.map((t) => ({
        ...t,
        breadcrumb: getBreadcrumb(t),
        updatedAt: t.updatedAt.toISOString(),
      })),
      commented: commentedTasks.map((c) => ({
        id: c.id,
        content: c.content.slice(0, 300),
        author: c.user,
        task: c.item,
        createdAt: c.createdAt.toISOString(),
      })),
    },
    channels: {
      mentions: channelMentions,
      threadReplies: threadReplies.map((r) => ({
        id: r.id,
        channelId: r.channelId,
        channelName: r.channel.displayName || r.channel.name,
        threadId: r.parentId,
        content: r.content.slice(0, 300),
        author: r.user,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    summary: {
      newTaskCount: assignedTasks.length,
      updatedTaskCount: updatedTasks.length,
      commentCount: commentedTasks.length,
      mentionCount: channelMentions.length,
      threadReplyCount: threadReplies.length,
      actionRequiredCount: actionableTaskCount,
    },
  }
})
