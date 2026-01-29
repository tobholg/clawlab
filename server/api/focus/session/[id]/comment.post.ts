// POST /api/focus/session/[id]/comment - Add comment to a focus session
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const sessionId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { comment } = body

  if (!sessionId) {
    throw createError({ statusCode: 400, message: 'Session ID is required' })
  }

  if (!comment || typeof comment !== 'string') {
    throw createError({ statusCode: 400, message: 'Comment is required' })
  }

  const now = new Date()

  const session = await prisma.focusSession.update({
    where: { id: sessionId },
    data: {
      comment,
      commentedAt: now,
    },
    include: {
      task: { select: { id: true, title: true } },
      project: { select: { id: true, title: true } },
    }
  })

  return {
    success: true,
    session: {
      id: session.id,
      comment: session.comment,
      commentedAt: session.commentedAt,
      task: session.task,
      project: session.project,
    }
  }
})
