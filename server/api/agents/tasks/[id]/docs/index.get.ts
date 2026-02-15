import { prisma } from '../../../../../utils/prisma'
import { getDisplayName, requireAgentUser, requireAssignedTask } from '../../../../../utils/agentApi'

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const agent = requireAgentUser(event)
  await requireAssignedTask(agent.id, taskId)

  const docs = await prisma.document.findMany({
    where: { itemId: taskId },
    include: {
      createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      lastEditedBy: { select: { id: true, name: true, email: true, avatar: true } },
      _count: { select: { versions: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  return docs.map((doc) => ({
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
    versionCount: doc._count.versions,
  }))
})
