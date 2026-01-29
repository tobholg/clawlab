// POST /api/focus/complete-task - Complete current task and end focus session
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, comment, markTaskDone = true } = body

  if (!userId) {
    throw createError({ statusCode: 400, message: 'userId is required' })
  }

  // Get current user state
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentProjectFocusId: true,
      currentTaskFocusId: true,
      currentLaneFocus: true,
      currentActivityStart: true,
    }
  })

  if (!user?.currentTaskFocusId) {
    throw createError({ statusCode: 400, message: 'No active task focus to complete' })
  }

  const now = new Date()
  const taskId = user.currentTaskFocusId

  // End the task focus session
  const updatedSession = await prisma.focusSession.updateMany({
    where: {
      userId,
      taskId,
      endedAt: null,
    },
    data: {
      endedAt: now,
      endReason: 'COMPLETED',
      comment: comment || null,
      commentedAt: comment ? now : null,
    }
  })

  // Optionally mark the task as done
  if (markTaskDone) {
    await prisma.item.update({
      where: { id: taskId },
      data: {
        status: 'DONE',
        progress: 100,
        updatedAt: now,
        lastActivityAt: now,
      }
    })
  }

  // Switch to GENERAL lane (stay in project context)
  await prisma.user.upsert({
    where: { id: userId },
    update: {
      currentTaskFocusId: null,
      currentLaneFocus: 'GENERAL',
      currentActivityStart: now,
    },
    create: {
      id: userId,
      email: `${userId}@demo.local`,
      currentLaneFocus: 'GENERAL',
      currentActivityStart: now,
    }
  })

  // Create new GENERAL lane session
  await prisma.focusSession.create({
    data: {
      userId,
      activityType: 'LANE',
      lane: 'GENERAL',
      projectId: user.currentProjectFocusId,
      startedAt: now,
    }
  })

  // Get task details for response
  const task = await prisma.item.findUnique({
    where: { id: taskId },
    select: { id: true, title: true }
  })

  // Calculate session duration
  let sessionDuration = null
  if (user.currentActivityStart) {
    const durationMs = now.getTime() - new Date(user.currentActivityStart).getTime()
    sessionDuration = Math.round(durationMs / 60000) // minutes
  }

  return {
    success: true,
    completedTask: {
      id: taskId,
      title: task?.title,
    },
    sessionDuration, // minutes
    newState: {
      lane: 'GENERAL',
      projectId: user.currentProjectFocusId,
    }
  }
})
