import { defineEventHandler, getRouterParam, readBody, createError } from 'h3'
import { prisma } from '../../../../../../utils/prisma'
import { requireUser } from '../../../../../../utils/auth'

// Add a comment to an information request (team member)
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const projectId = getRouterParam(event, 'projectId')
  const irId = getRouterParam(event, 'irId')

  if (!projectId || !irId) {
    throw createError({ statusCode: 400, statusMessage: 'Project ID and IR ID are required' })
  }

  const body = await readBody<{ content: string }>(event)
  
  if (!body.content?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Comment content is required' })
  }

  // Verify user has access to this project (is a workspace member)
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

  // Create the comment as a team member
  const comment = await prisma.externalComment.create({
    data: {
      informationRequestId: irId,
      authorId: user.id,
      content: body.content.trim(),
      isTeamMember: true
    },
    include: {
      author: {
        select: { id: true, name: true }
      }
    }
  })

  return {
    comment: {
      id: comment.id,
      authorName: comment.author.name || 'Team',
      content: comment.content,
      isTeamMember: true,
      createdAt: comment.createdAt.toISOString()
    }
  }
})
