// GET /api/focus/current - Get current focus state for a user
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const userId = query.userId as string

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      currentProjectFocusId: true,
      currentProjectFocusStart: true,
      currentTaskFocusId: true,
      currentLaneFocus: true,
      currentActivityStart: true,
      currentProjectFocus: {
        select: { id: true, title: true, workspaceId: true }
      },
      currentTaskFocus: {
        select: { id: true, title: true, status: true }
      }
    }
  })

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  return {
    userId: user.id,
    project: user.currentProjectFocus ? {
      id: user.currentProjectFocus.id,
      title: user.currentProjectFocus.title,
      workspaceId: user.currentProjectFocus.workspaceId,
      since: user.currentProjectFocusStart,
    } : null,
    task: user.currentTaskFocus ? {
      id: user.currentTaskFocus.id,
      title: user.currentTaskFocus.title,
      status: user.currentTaskFocus.status,
      since: user.currentActivityStart,
    } : null,
    lane: user.currentLaneFocus ? {
      type: user.currentLaneFocus,
      since: user.currentActivityStart,
    } : null,
    activityStart: user.currentActivityStart,
  }
})
