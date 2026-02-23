import { prisma } from '../../utils/prisma'
import { requireTokenUser } from '../../utils/agentApi'

const VALID_STATUS = new Set(['IDLE', 'ACTIVE', 'AWAITING_REVIEW', 'TERMINATED'])

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null
}

function toDurationMs(start: Date | null, end: Date | null, now: Date) {
  if (!start) return null
  const target = end ?? now
  return Math.max(0, target.getTime() - start.getTime())
}

export default defineEventHandler(async (event) => {
  const agent = await requireTokenUser(event)
  const query = getQuery(event)
  const currentOnly = String(query.current ?? '').toLowerCase() === 'true'

  const rawStatus = typeof query.status === 'string' ? query.status.trim().toUpperCase() : null
  let normalizedStatus: 'IDLE' | 'ACTIVE' | 'AWAITING_REVIEW' | 'TERMINATED' | null = null
  if (rawStatus) {
    const aliasStatus = rawStatus === 'AWAITING-REVIEW' ? 'AWAITING_REVIEW' : rawStatus
    if (!VALID_STATUS.has(aliasStatus)) {
      throw createError({ statusCode: 400, message: 'Invalid status filter' })
    }
    normalizedStatus = aliasStatus as 'IDLE' | 'ACTIVE' | 'AWAITING_REVIEW' | 'TERMINATED'
  }

  const where = {
    agentId: agent.id,
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(currentOnly && !normalizedStatus ? { status: 'ACTIVE' as const } : {}),
  }

  const now = new Date()
  const sessions = currentOnly
    ? await prisma.agentSession.findFirst({
        where,
        include: {
          item: {
            select: {
              id: true,
              title: true,
              status: true,
              subStatus: true,
              progress: true,
              agentMode: true,
              projectId: true,
              parentId: true,
            },
          },
        },
        orderBy: [
          { checkedOutAt: 'desc' },
          { updatedAt: 'desc' },
        ],
      })
    : await prisma.agentSession.findMany({
        where,
        include: {
          item: {
            select: {
              id: true,
              title: true,
              status: true,
              subStatus: true,
              progress: true,
              agentMode: true,
              projectId: true,
              parentId: true,
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      })

  const asArray = Array.isArray(sessions) ? sessions : (sessions ? [sessions] : [])
  const projectIds = [...new Set(asArray
    .map((session) => session.projectId ?? session.item?.projectId ?? session.item?.parentId ?? null)
    .filter((id): id is string => !!id))]

  const projects = projectIds.length
    ? await prisma.item.findMany({
        where: { id: { in: projectIds } },
        select: { id: true, title: true },
      })
    : []

  const projectMap = new Map(projects.map((project) => [project.id, project]))
  const responseSessions = asArray.map((session) => {
    const resolvedProjectId = session.projectId ?? session.item?.projectId ?? session.item?.parentId ?? null
    const project = resolvedProjectId ? projectMap.get(resolvedProjectId) : null

    return {
      id: session.id,
      agentId: session.agentId,
      itemId: session.itemId,
      projectId: session.projectId,
      terminalId: session.terminalId,
      status: session.status,
      checkedOutAt: toIso(session.checkedOutAt),
      completedAt: toIso(session.completedAt),
      createdAt: toIso(session.createdAt),
      updatedAt: toIso(session.updatedAt),
      durationMs: toDurationMs(session.checkedOutAt, session.completedAt, now),
      task: session.item
        ? {
            id: session.item.id,
            title: session.item.title,
            status: session.item.status,
            subStatus: session.item.subStatus,
            progress: session.item.progress,
            agentMode: session.item.agentMode,
          }
        : null,
      project: project
        ? {
            id: project.id,
            title: project.title,
          }
        : null,
      agent: {
        id: agent.id,
        name: agent.name ?? agent.email.split('@')[0],
      },
    }
  })

  if (currentOnly) {
    return responseSessions[0] ?? null
  }

  return responseSessions
})
