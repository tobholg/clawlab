// POST /api/focus/session/[id]/comment - Add comment to a focus session
import { prisma } from '../../../../utils/prisma'
import { requireUser } from '../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const sessionId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const { comment } = body

  if (!sessionId) {
    throw createError({ statusCode: 400, message: 'Session ID is required' })
  }

  if (!comment || typeof comment !== 'string') {
    throw createError({ statusCode: 400, message: 'Comment is required' })
  }

  // Verify the session belongs to this user
  const existing = await prisma.focusSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  })
  if (!existing) {
    throw createError({ statusCode: 404, message: 'Session not found' })
  }
  if (existing.userId !== user.id) {
    throw createError({ statusCode: 403, statusMessage: 'You can only comment on your own sessions' })
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
