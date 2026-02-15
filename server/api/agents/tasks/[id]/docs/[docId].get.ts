import { prisma } from '../../../../../utils/prisma'
import { getDisplayName, requireAgentUser, requireAssignedTask } from '../../../../../utils/agentApi'

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  const docId = getRouterParam(event, 'docId')

  if (!taskId || !docId) {
    throw createError({ statusCode: 400, message: 'Task ID and doc ID are required' })
  }

  const agent = requireAgentUser(event)
  await requireAssignedTask(agent.id, taskId)

  const doc = await prisma.document.findFirst({
    where: {
      id: docId,
      itemId: taskId,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      lastEditedBy: { select: { id: true, name: true, email: true, avatar: true } },
      versions: {
        include: {
          createdBy: { select: { id: true, name: true, email: true, avatar: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!doc) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  return {
    id: doc.id,
    itemId: doc.itemId,
    projectId: doc.projectId,
    title: doc.title,
    content: doc.content,
    isLocked: doc.isLocked,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    createdBy: {
      id: doc.createdBy.id,
      name: getDisplayName(doc.createdBy),
      avatar: doc.createdBy.avatar,
    },
    lastEditedBy: doc.lastEditedBy
      ? {
          id: doc.lastEditedBy.id,
          name: getDisplayName(doc.lastEditedBy),
          avatar: doc.lastEditedBy.avatar,
        }
      : null,
    versions: doc.versions.map((version) => ({
      id: version.id,
      title: version.title,
      content: version.content,
      label: version.label,
      notes: version.notes,
      type: version.type,
      createdAt: version.createdAt.toISOString(),
      createdBy: {
        id: version.createdBy.id,
        name: getDisplayName(version.createdBy),
        avatar: version.createdBy.avatar,
      },
    })),
  }
})
