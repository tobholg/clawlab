import { prisma } from '../../../../../utils/prisma'
import { getDisplayName, requireAgentUser, requireAssignedTask } from '../../../../../utils/agentApi'

const MAX_COMMENT_LENGTH = 5000

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const body = await readBody(event)
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!content) {
    throw createError({ statusCode: 400, message: 'content is required' })
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    throw createError({ statusCode: 400, message: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer` })
  }

  const agent = requireAgentUser(event)
  await requireAssignedTask(agent.id, taskId)

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        itemId: taskId,
        userId: agent.id,
        content,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    })

    await tx.item.update({
      where: { id: taskId },
      data: { lastActivityAt: new Date() },
    })

    await tx.activity.create({
      data: {
        itemId: taskId,
        userId: agent.id,
        type: 'COMMENT',
        metadata: { commentId: created.id },
      },
    })

    return created
  })

  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    user: {
      id: comment.user.id,
      name: getDisplayName(comment.user),
      avatar: comment.user.avatar,
    },
  }
})
