// POST /api/focus/task - Start focus on a task
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { userId, taskId } = body

  if (!userId || !taskId) {
    throw createError({ statusCode: 400, message: 'userId and taskId are required' })
  }

  // Get the task and its root project
  const task = await prisma.item.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      parentId: true,
      workspaceId: true,
    }
  })

  if (!task) {
    throw createError({ statusCode: 404, message: 'Task not found' })
  }

  // Find root project (traverse up the hierarchy)
  let projectId = task.parentId
  if (projectId) {
    let current = await prisma.item.findUnique({
      where: { id: projectId },
      select: { id: true, parentId: true, title: true }
    })
    while (current?.parentId) {
      projectId = current.parentId
      current = await prisma.item.findUnique({
        where: { id: projectId },
        select: { id: true, parentId: true, title: true }
      })
    }
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

  // End current lane session if any
  if (user?.currentLaneFocus && user.currentActivityStart) {
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

  // Get project details if we found one
  let projectTitle = null
  if (projectId) {
    const project = await prisma.item.findUnique({
      where: { id: projectId },
      select: { title: true }
    })
    projectTitle = project?.title
  }

  // Update user focus state
  // If task has a project and it's different from current, switch project too
  const isNewProject = projectId && user?.currentProjectFocusId !== projectId

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      currentProjectFocusId: projectId,
      currentProjectFocusStart: isNewProject ? now : undefined,
      currentTaskFocusId: taskId,
      currentLaneFocus: null, // Clear lane when focusing on task
      currentActivityStart: now,
    },
    create: {
      id: userId,
      email: `${userId}@demo.local`,
      currentProjectFocusId: projectId,
      currentProjectFocusStart: now,
      currentTaskFocusId: taskId,
      currentLaneFocus: null,
      currentActivityStart: now,
    }
  })

  // Create task focus session
  await prisma.focusSession.create({
    data: {
      userId,
      activityType: 'TASK',
      taskId,
      projectId,
      startedAt: now,
    }
  })

  return {
    success: true,
    taskId,
    taskTitle: task.title,
    projectId,
    projectTitle,
    activityStart: now,
  }
})
