import { prisma } from '../../../../utils/prisma'
import { requireAgentUser, requireAssignedTask } from '../../../../utils/agentApi'
import { getDefaultSubStatus } from '../../../../utils/itemStage'
import { emitSubtaskCreated } from '../../../../utils/agentNotify'

const MAX_TITLE_LENGTH = 255
const MAX_DESCRIPTION_LENGTH = 10000
const VALID_PRIORITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

export default defineEventHandler(async (event) => {
  const parentTaskId = getRouterParam(event, 'id')
  if (!parentTaskId) {
    throw createError({ statusCode: 400, message: 'Parent task ID is required' })
  }

  const body = await readBody(event)
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : null
  const category = typeof body.category === 'string' ? body.category.trim() : null
  const priority = typeof body.priority === 'string' ? body.priority.toUpperCase() : undefined

  if (!title) {
    throw createError({ statusCode: 400, message: 'title is required' })
  }

  if (title.length > MAX_TITLE_LENGTH) {
    throw createError({ statusCode: 400, message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` })
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw createError({ statusCode: 400, message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` })
  }

  if (priority && !VALID_PRIORITIES.has(priority)) {
    throw createError({ statusCode: 400, message: 'Invalid priority value' })
  }

  const agent = requireAgentUser(event)
  const parentTask = await requireAssignedTask(agent.id, parentTaskId)

  const created = await prisma.item.create({
    data: {
      workspaceId: parentTask.workspaceId,
      parentId: parentTaskId,
      projectId: parentTask.projectId ?? parentTaskId,
      ownerId: agent.id,
      title,
      description,
      category: category?.length ? category : null,
      status: 'TODO',
      subStatus: getDefaultSubStatus('TODO'),
      priority: (priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined) ?? 'MEDIUM',
      lastActivityAt: new Date(),
      assignees: {
        create: [{ userId: agent.id }],
      },
      activities: {
        create: {
          userId: agent.id,
          type: 'CREATED',
        },
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      status: true,
      subStatus: true,
      priority: true,
      parentId: true,
      projectId: true,
      ownerId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  // Emit real-time notification
  const taskCtx = { id: parentTaskId, title: parentTask.title, workspaceId: parentTask.workspaceId, projectId: parentTask.projectId }
  emitSubtaskCreated(agent, taskCtx, title).catch(() => {})

  return {
    id: created.id,
    title: created.title,
    description: created.description,
    category: created.category,
    status: created.status,
    subStatus: created.subStatus,
    priority: created.priority,
    parentId: created.parentId,
    projectId: created.projectId,
    ownerId: created.ownerId,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  }
})
