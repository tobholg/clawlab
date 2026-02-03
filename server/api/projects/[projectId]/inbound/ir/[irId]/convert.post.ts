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

  const body = await readBody(event) || {}
  const { title, category, parentId } = body

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

  // Verify the IR belongs to a space in this project and is a suggestion
  const ir = await prisma.informationRequest.findFirst({
    where: {
      id: irId,
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

  if (!ir) {
    throw createError({ statusCode: 404, statusMessage: 'Information request not found' })
  }

  if (ir.type !== 'SUGGESTION') {
    throw createError({ statusCode: 400, statusMessage: 'Only suggestions can be converted to tasks' })
  }

  if (ir.convertedToTaskId) {
    throw createError({ statusCode: 400, statusMessage: 'This suggestion has already been converted to a task' })
  }

  // Extract title from suggestion content (first line or provided)
  const suggestedTitle = title || extractTitle(ir.content)

  // Create a real Item (task) in the project
  const newItem = await prisma.item.create({
    data: {
      workspaceId: project.workspaceId,
      parentId: parentId || projectId,
      projectId: projectId,
      title: suggestedTitle,
      description: `${ir.content}\n\n---\n*Suggested via ${ir.externalSpace.name}*`,
      category: category || undefined,
      status: 'TODO',
      progress: 0,
      confidence: 70,
      ownerId: user.id
    }
  })

  // Update the IR to mark it as accepted
  const updatedIR = await prisma.informationRequest.update({
    where: { id: irId },
    data: {
      status: 'ACCEPTED',
      convertedToTaskId: newItem.id,
      respondedById: user.id,
      respondedAt: new Date(),
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
        source: 'suggestion',
        informationRequestId: irId,
        spaceName: ir.externalSpace.name
      }
    }
  })

  return {
    ir: {
      id: updatedIR.id,
      status: updatedIR.status.toLowerCase(),
      convertedToTaskId: updatedIR.convertedToTaskId
    },
    item: {
      id: newItem.id,
      title: newItem.title,
      status: newItem.status,
      parentId: newItem.parentId
    }
  }
})

// Helper to extract a title from suggestion content
function extractTitle(content: string): string {
  // Try to get first line as title
  const firstLine = content.split('\n')[0].trim()
  
  // If first line looks like a title (short enough), use it
  if (firstLine.length > 0 && firstLine.length <= 100) {
    // Remove common prefixes
    return firstLine
      .replace(/^(feature suggestion:|suggestion:|idea:|feature:|request:)/i, '')
      .trim()
  }
  
  // Otherwise, truncate content
  return content.substring(0, 80) + (content.length > 80 ? '...' : '')
}
