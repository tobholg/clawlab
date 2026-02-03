import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../../../../utils/prisma'
import { requireUser } from '../../../../../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = getRouterParam(event, 'projectId')
  const irId = getRouterParam(event, 'irId')

  if (!projectId || !irId) {
    throw createError({ statusCode: 400, statusMessage: 'Project ID and IR ID are required' })
  }

  const body = await readBody(event)
  const { response, status, addedToAIContext } = body

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

  // Verify the IR belongs to a space in this project
  const ir = await prisma.informationRequest.findFirst({
    where: {
      id: irId,
      externalSpace: {
        projectId
      }
    }
  })

  if (!ir) {
    throw createError({ statusCode: 404, statusMessage: 'Information request not found' })
  }

  // Build update data
  const updateData: any = {
    updatedAt: new Date()
  }

  // Handle response (answering the IR)
  if (response !== undefined) {
    updateData.response = response
    updateData.respondedById = user.id
    updateData.respondedAt = new Date()
    updateData.status = 'ANSWERED'
  }

  // Handle explicit status change (for declining)
  if (status !== undefined) {
    const validStatuses = ['PENDING', 'ANSWERED', 'ACCEPTED', 'DECLINED']
    const upperStatus = status.toUpperCase()
    if (!validStatuses.includes(upperStatus)) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
    }
    updateData.status = upperStatus
    
    // If declining, record who declined
    if (upperStatus === 'DECLINED') {
      updateData.respondedById = user.id
      updateData.respondedAt = new Date()
    }
  }

  // Handle AI context flag
  if (addedToAIContext !== undefined) {
    updateData.addedToAIContext = Boolean(addedToAIContext)
  }

  const updatedIR = await prisma.informationRequest.update({
    where: { id: irId },
    data: updateData,
    include: {
      respondedBy: {
        select: { id: true, name: true }
      }
    }
  })

  return {
    ir: {
      id: updatedIR.id,
      type: updatedIR.type.toLowerCase(),
      content: updatedIR.content,
      status: updatedIR.status.toLowerCase(),
      response: updatedIR.response,
      respondedAt: updatedIR.respondedAt?.toISOString(),
      respondedBy: updatedIR.respondedBy?.name,
      addedToAIContext: updatedIR.addedToAIContext,
      convertedToTaskId: updatedIR.convertedToTaskId,
      updatedAt: updatedIR.updatedAt.toISOString()
    }
  }
})
