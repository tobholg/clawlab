import { prisma } from '../../utils/prisma'
import { requireAgentUser, requireAssignedProject } from '../../utils/agentApi'

const VALID_ITEM_STATUSES = new Set(['TODO', 'IN_PROGRESS', 'BLOCKED', 'PAUSED', 'DONE'])
const VALID_AGENT_MODES = new Set(['PLAN', 'EXECUTE'])

export default defineEventHandler(async (event) => {
  const agent = requireAgentUser(event)
  const query = getQuery(event)

  const projectId = typeof query.projectId === 'string' ? query.projectId : undefined
  const status = typeof query.status === 'string' ? query.status.toUpperCase() : undefined
  const agentMode = typeof query.agentMode === 'string' ? query.agentMode.toUpperCase() : undefined
  const subStatus = typeof query.subStatus === 'string' ? query.subStatus.trim() : undefined

  if (status && !VALID_ITEM_STATUSES.has(status)) {
    throw createError({ statusCode: 400, message: 'Invalid status filter' })
  }

  if (agentMode && !VALID_AGENT_MODES.has(agentMode)) {
    throw createError({ statusCode: 400, message: 'Invalid agentMode filter' })
  }

  if (projectId) {
    await requireAssignedProject(agent.id, projectId)
  }

  const tasks = await prisma.item.findMany({
    where: {
      parentId: { not: null },
      assignees: { some: { userId: agent.id } },
      ...(projectId ? { projectId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(agentMode ? { agentMode: agentMode as any } : {}),
      ...(subStatus ? { subStatus } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      subStatus: true,
      agentMode: true,
      priority: true,
      planDocId: true,
      acceptedPlanVersion: true,
      parentId: true,
      projectId: true,
      progress: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    subStatus: task.subStatus,
    agentMode: task.agentMode,
    priority: task.priority,
    planDocId: task.planDocId,
    acceptedPlanVersion: task.acceptedPlanVersion,
    parentId: task.parentId,
    projectId: task.projectId,
    progress: task.progress,
    updatedAt: task.updatedAt.toISOString(),
  }))
})
