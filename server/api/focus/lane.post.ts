// POST /api/focus/lane - Switch to a lane (general, meeting, admin, learning, break)
import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

const VALID_LANES = ['GENERAL', 'MEETING', 'ADMIN', 'LEARNING', 'BREAK'] as const

export default defineEventHandler(async (event) => {
  const authUser = await requireUser(event)
  const body = await readBody(event)
  const userId = authUser.id
  const { lane } = body

  if (!lane) {
    throw createError({ statusCode: 400, message: 'lane is required' })
  }

  const upperLane = lane.toUpperCase()
  if (!VALID_LANES.includes(upperLane as any)) {
    throw createError({ 
      statusCode: 400, 
      message: `Invalid lane. Must be one of: ${VALID_LANES.join(', ')}` 
    })
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

  const now = new Date()

  // If already on this lane (and no task), do nothing - avoid duplicates
  if (user?.currentLaneFocus === upperLane && !user?.currentTaskFocusId) {
    return {
      success: true,
      lane: upperLane,
      projectId: user?.currentProjectFocusId,
      activityStart: user?.currentActivityStart ?? now,
      alreadyActive: true,
    }
  }

  // End current task session if any
  if (user?.currentTaskFocusId) {
    await prisma.focusSession.updateMany({
      where: {
        userId,
        taskId: user.currentTaskFocusId,
        endedAt: null,
      },
      data: {
        endedAt: now,
        endReason: 'SWITCHED',
      }
    })
  }

  // End current lane session if different lane
  if (user?.currentLaneFocus && user.currentLaneFocus !== upperLane) {
    await prisma.focusSession.updateMany({
      where: {
        userId,
        lane: user.currentLaneFocus,
        endedAt: null,
      },
      data: {
        endedAt: now,
        endReason: 'SWITCHED',
      }
    })
  }

  // Update user focus state
  await prisma.user.upsert({
    where: { id: userId },
    update: {
      currentTaskFocusId: null, // Clear task
      currentLaneFocus: upperLane as any,
      currentActivityStart: now,
    },
    create: {
      id: userId,
      email: `${userId}@demo.local`,
      currentTaskFocusId: null,
      currentLaneFocus: upperLane as any,
      currentActivityStart: now,
    }
  })

  // Create lane focus session
  await prisma.focusSession.create({
    data: {
      userId,
      activityType: 'LANE',
      lane: upperLane as any,
      projectId: user?.currentProjectFocusId,
      startedAt: now,
    }
  })

  return {
    success: true,
    lane: upperLane,
    projectId: user?.currentProjectFocusId,
    activityStart: now,
  }
})
