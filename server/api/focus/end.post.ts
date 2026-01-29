// POST /api/focus/end - End all focus (task/lane and optionally project)
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, comment, endProject = false } = body

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  // Get current user state
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentProjectFocusId: true,
      currentProjectFocusStart: true,
      currentTaskFocusId: true,
      currentLaneFocus: true,
      currentActivityStart: true,
    }
  })

  const now = new Date()

  // End task session if any
  if (user?.currentTaskFocusId) {
    await prisma.focusSession.updateMany({
      where: {
        userId,
        taskId: user.currentTaskFocusId,
        endedAt: null,
      },
      data: {
        endedAt: now,
        endReason: 'MANUAL_EXIT',
        comment: comment || null,
        commentedAt: comment ? now : null,
      }
    })
  }

  // End lane session if any
  if (user?.currentLaneFocus) {
    await prisma.focusSession.updateMany({
      where: {
        userId,
        lane: user.currentLaneFocus,
        endedAt: null,
      },
      data: {
        endedAt: now,
        endReason: 'MANUAL_EXIT',
        comment: !user.currentTaskFocusId ? (comment || null) : null,
        commentedAt: !user.currentTaskFocusId && comment ? now : null,
      }
    })
  }

  // Update user state
  if (endProject) {
    // End everything - back to unfocused state
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentProjectFocusId: null,
        currentProjectFocusStart: null,
        currentTaskFocusId: null,
        currentLaneFocus: null,
        currentActivityStart: null,
      }
    })
  } else {
    // Just end activity, keep project context, go to GENERAL
    await prisma.user.update({
      where: { id: userId },
      data: {
        currentTaskFocusId: null,
        currentLaneFocus: 'GENERAL',
        currentActivityStart: now,
      }
    })

    // Create new GENERAL session if still in a project
    if (user?.currentProjectFocusId) {
      await prisma.focusSession.create({
        data: {
          userId,
          activityType: 'LANE',
          lane: 'GENERAL',
          projectId: user.currentProjectFocusId,
          startedAt: now,
        }
      })
    }
  }

  return {
    success: true,
    endedProject: endProject,
  }
})
