import { prisma } from '../../../../../utils/prisma'
import { getDisplayName, requireAgentUser, requireAssignedTask } from '../../../../../utils/agentApi'
import { emitDocCreated } from '../../../../../utils/agentNotify'

const MAX_TITLE_LENGTH = 255
const MAX_DOCUMENTS_PER_TASK = 25

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const body = await readBody(event)
  const title = typeof body.title === 'string' ? body.title.trim() : 'Untitled document'
  const content = typeof body.content === 'string' ? body.content : ''
  const setAsPlan = body.setAsPlan === true

  if (!title) {
    throw createError({ statusCode: 400, message: 'title is required' })
  }

  if (title.length > MAX_TITLE_LENGTH) {
    throw createError({ statusCode: 400, message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` })
  }

  const agent = requireAgentUser(event)
  const task = await requireAssignedTask(agent.id, taskId)

  if (setAsPlan && task.agentMode !== 'PLAN') {
    throw createError({ statusCode: 400, message: 'setAsPlan is only allowed when task agentMode is PLAN' })
  }

  const existingCount = await prisma.document.count({ where: { itemId: taskId } })
  if (existingCount >= MAX_DOCUMENTS_PER_TASK) {
    throw createError({
      statusCode: 403,
      message: `Maximum of ${MAX_DOCUMENTS_PER_TASK} documents per task reached`,
    })
  }

  const now = new Date()
  const created = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        itemId: taskId,
        projectId: task.projectId ?? taskId,
        title,
        content,
        createdById: agent.id,
        lastEditedById: agent.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
        lastEditedBy: { select: { id: true, name: true, email: true, avatar: true } },
        _count: { select: { versions: true } },
      },
    })

    await tx.item.update({
      where: { id: taskId },
      data: {
        ...(setAsPlan ? { planDocId: doc.id } : {}),
        lastActivityAt: now,
      },
    })

    return doc
  })

  // Emit real-time notification
  const taskCtx = { id: taskId, title: task.title, workspaceId: task.workspaceId, projectId: task.projectId }
  emitDocCreated(agent, taskCtx, title).catch(() => {})

  return {
    id: created.id,
    itemId: created.itemId,
    projectId: created.projectId,
    title: created.title,
    content: created.content,
    isLocked: created.isLocked,
    setAsPlan,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    createdBy: {
      id: created.createdBy.id,
      name: getDisplayName(created.createdBy),
      avatar: created.createdBy.avatar,
    },
    lastEditedBy: created.lastEditedBy
      ? {
          id: created.lastEditedBy.id,
          name: getDisplayName(created.lastEditedBy),
          avatar: created.lastEditedBy.avatar,
        }
      : null,
    versionCount: created._count.versions,
  }
})
