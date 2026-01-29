// POST /api/focus/project - Start or switch project focus
import { prisma } from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, projectId } = body

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

  const now = new Date()

  // If switching projects, end current task focus session
  if (user?.currentTaskFocusId && user.currentProjectFocusId !== projectId) {
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

  // If switching projects (or clearing), end current lane session if any
  if (user?.currentLaneFocus && user.currentActivityStart && user.currentProjectFocusId !== projectId) {
    await prisma.focusSession.updateMany({
      where: {
        userId,
        lane: user.currentLaneFocus,
        projectId: user.currentProjectFocusId,
        endedAt: null,
      },
      data: {
        endedAt: now,
        endReason: 'SWITCHED',
      }
    })
  }

  // If projectId is null, we're clearing project focus entirely
  if (!projectId) {
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
    return { success: true, projectId: null }
  }

  // Verify project exists and is a root item (no parent)
  const project = await prisma.item.findFirst({
    where: { id: projectId, parentId: null },
    select: { id: true, title: true, workspaceId: true }
  })

  if (!project) {
    throw createError({ statusCode: 404, message: 'Project not found' })
  }

  // Start new project focus with GENERAL lane
  const isNewProject = user?.currentProjectFocusId !== projectId

  await prisma.user.update({
    where: { id: userId },
    data: {
      currentProjectFocusId: projectId,
      currentProjectFocusStart: isNewProject ? now : undefined,
      currentTaskFocusId: null, // Clear task when switching projects
      currentLaneFocus: 'GENERAL',
      currentActivityStart: now,
    }
  })

  // Create lane focus session for GENERAL
  if (isNewProject) {
    await prisma.focusSession.create({
      data: {
        userId,
        activityType: 'LANE',
        lane: 'GENERAL',
        projectId,
        startedAt: now,
      }
    })
  }

  return {
    success: true,
    projectId,
    projectTitle: project.title,
    projectFocusStart: now,
    lane: 'GENERAL',
    activityStart: now,
  }
})
