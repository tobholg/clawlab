import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../../../../utils/prisma'
import { requireUser } from '../../../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = getRouterParam(event, 'projectId')
  const taskId = getRouterParam(event, 'taskId')

  if (!projectId || !taskId) {
    throw createError({ statusCode: 400, statusMessage: 'Project ID and Task ID are required' })
  }

  const body = await readBody(event) || {}
  const { category, parentId } = body // Optional: specify which subproject/category

  // Verify user has access to this project
  const project = await prisma.item.findFirst({
    where: {
      id: projectId,
      parentId: null,
      workspace: {
        members: {
          some: { userId: user.id }
        }
      }
    },
    select: { id: true, workspaceId: true }
  })

  if (!project) {
    throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  }

  // Verify the task belongs to a space in this project and is pending
  const externalTask = await prisma.externalTask.findFirst({
    where: {
      id: taskId,
      externalSpace: {
        projectId
      }
    },
    include: {
      externalSpace: {
        select: { name: true }
      }
    }
  })

  if (!externalTask) {
    throw createError({ statusCode: 404, statusMessage: 'External task not found' })
  }

  if (externalTask.status === 'ACCEPTED') {
    throw createError({ statusCode: 400, statusMessage: 'Task has already been accepted' })
  }

  // Create a real Item (task) in the project
  const newItem = await prisma.item.create({
    data: {
      workspaceId: project.workspaceId,
      parentId: parentId || projectId, // Default to project root
      projectId: projectId,
      title: externalTask.title,
      description: `${externalTask.description}\n\n---\n*Submitted via ${externalTask.externalSpace.name}*`,
      category: category || undefined,
      status: 'TODO',
      progress: 0,
      confidence: 70,
      ownerId: user.id // Assign to the accepting user by default
    }
  })

  // Update the external task
  const updatedTask = await prisma.externalTask.update({
    where: { id: taskId },
    data: {
      status: 'ACCEPTED',
      linkedTaskId: newItem.id,
      updatedAt: new Date()
    }
  })

  // Create activity for the new item
  await prisma.activity.create({
    data: {
      itemId: newItem.id,
      userId: user.id,
      type: 'CREATED',
      metadata: {
        source: 'external_task',
        externalTaskId: taskId,
        spaceName: externalTask.externalSpace.name
      }
    }
  })

  return {
    task: {
      id: updatedTask.id,
      status: updatedTask.status.toLowerCase(),
      linkedTaskId: updatedTask.linkedTaskId
    },
    item: {
      id: newItem.id,
      title: newItem.title,
      status: newItem.status,
      parentId: newItem.parentId
    }
  }
})
