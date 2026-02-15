import { prisma } from '../../../utils/prisma'
import { getDisplayName, requireAgentUser, requireAssignedTask } from '../../../utils/agentApi'

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const agent = requireAgentUser(event)
  await requireAssignedTask(agent.id, taskId)

  const task = await prisma.item.findUnique({
    where: { id: taskId },
    include: {
      parent: {
        select: {
          id: true,
          title: true,
        },
      },
      children: {
        include: {
          owner: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          assignees: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatar: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
      documents: {
        include: {
          createdBy: { select: { id: true, name: true, email: true, avatar: true } },
          lastEditedBy: { select: { id: true, name: true, email: true, avatar: true } },
          _count: { select: { versions: true } },
        },
        orderBy: { updatedAt: 'desc' },
      },
      comments: {
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
      },
    },
  })

  if (!task) {
    throw createError({ statusCode: 404, message: 'Task not found' })
  }

  const projectId = task.projectId ?? (task.parentId ? task.parentId : task.id)
  const project = projectId
    ? await prisma.item.findUnique({
        where: { id: projectId },
        select: { id: true, title: true },
      })
    : null

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    subStatus: task.subStatus,
    progress: task.progress,
    agentMode: task.agentMode,
    planDocId: task.planDocId,
    acceptedPlanVersion: task.acceptedPlanVersion,
    parent: task.parent,
    project,
    subtasks: task.children.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      description: subtask.description,
      status: subtask.status,
      subStatus: subtask.subStatus,
      progress: subtask.progress,
      priority: subtask.priority,
      agentMode: subtask.agentMode,
      owner: subtask.owner
        ? {
            id: subtask.owner.id,
            name: getDisplayName(subtask.owner),
            avatar: subtask.owner.avatar,
          }
        : null,
      assignees: subtask.assignees.map((assignment) => ({
        id: assignment.user.id,
        name: getDisplayName(assignment.user),
        avatar: assignment.user.avatar,
      })),
      createdAt: subtask.createdAt.toISOString(),
      updatedAt: subtask.updatedAt.toISOString(),
    })),
    documents: task.documents.map((doc) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      isLocked: doc.isLocked,
      versionCount: doc._count.versions,
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
    })),
    comments: task.comments.map((comment) => ({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      user: {
        id: comment.user.id,
        name: getDisplayName(comment.user),
        avatar: comment.user.avatar,
      },
    })),
  }
})
