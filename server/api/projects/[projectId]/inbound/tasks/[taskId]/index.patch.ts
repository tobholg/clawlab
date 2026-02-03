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

  const body = await readBody(event)
  const { status, internalNotes, rejectionReason } = body

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

  // Verify the task belongs to a space in this project
  const task = await prisma.externalTask.findFirst({
    where: {
      id: taskId,
      externalSpace: {
        projectId
      }
    }
  })

  if (!task) {
    throw createError({ statusCode: 404, statusMessage: 'External task not found' })
  }

  // Build update data
  const updateData: any = {
    updatedAt: new Date()
  }

  if (status) {
    const validStatuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'NEEDS_INFO']
    const upperStatus = status.toUpperCase()
    if (!validStatuses.includes(upperStatus)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    }
    updateData.status = upperStatus
  }

  if (internalNotes !== undefined) {
    updateData.internalNotes = internalNotes
  }

  if (rejectionReason !== undefined) {
    updateData.rejectionReason = rejectionReason
  }

  const updatedTask = await prisma.externalTask.update({
    where: { id: taskId },
    data: updateData,
    include: {
      submittedBy: {
        select: { id: true, name: true, email: true }
      }
    }
  })

  return {
    task: {
      id: updatedTask.id,
      title: updatedTask.title,
      description: updatedTask.description,
      status: updatedTask.status.toLowerCase(),
      internalNotes: updatedTask.internalNotes,
      rejectionReason: updatedTask.rejectionReason,
      linkedTaskId: updatedTask.linkedTaskId,
      updatedAt: updatedTask.updatedAt.toISOString()
    }
  }
})
