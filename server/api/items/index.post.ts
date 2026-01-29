import { prisma } from '../../utils/prisma'
import { createProjectChannel } from '../../utils/channelUtils'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  const { 
    workspaceId, 
    parentId, 
    title, 
    description, 
    category,
    status,
    dueDate,
    startDate,
    confidence,
    assigneeIds,
    stakeholderIds,
  } = body
  
  if (!workspaceId || !title) {
    throw createError({ statusCode: 400, message: 'workspaceId and title are required' })
  }
  
  // Determine final status and auto-set startDate
  const finalStatus = status?.toUpperCase() ?? 'TODO'
  const now = new Date()
  
  // Auto-set startDate to now if creating as IN_PROGRESS and no startDate provided
  let finalStartDate = startDate ? new Date(startDate) : null
  if (finalStatus === 'IN_PROGRESS' && !finalStartDate) {
    finalStartDate = now
  }
  
  // Set first assignee as owner by default
  const ownerId = body.ownerId ?? assigneeIds?.[0] ?? null
  
  const item = await prisma.item.create({
    data: {
      workspaceId,
      parentId: parentId || null,
      title,
      description,
      category,
      status: finalStatus,
      dueDate: dueDate ? new Date(dueDate) : null,
      startDate: finalStartDate,
      confidence: confidence ?? 70,
      ownerId,
      assignees: assigneeIds?.length ? {
        create: assigneeIds.map((userId: string) => ({ userId }))
      } : undefined,
      stakeholders: stakeholderIds?.length ? {
        create: stakeholderIds.map((userId: string) => ({ userId }))
      } : undefined,
    },
    include: {
      owner: true,
      assignees: { include: { user: true } },
      stakeholders: { include: { user: true } },
    }
  })
  
  // If this is a root-level item (project), create a project channel
  if (!parentId) {
    try {
      // Use first assignee as channel creator, or find any workspace member
      let creatorUserId = assigneeIds?.[0]
      if (!creatorUserId) {
        const member = await prisma.workspaceMember.findFirst({
          where: { workspaceId },
          select: { userId: true },
        })
        creatorUserId = member?.userId
      }
      if (creatorUserId) {
        await createProjectChannel(item.id, workspaceId, title, creatorUserId)
      }
    } catch (err) {
      console.error('Failed to create project channel:', err)
      // Don't fail the whole request if channel creation fails
    }
  }

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    parentId: item.parentId,
    status: item.status.toLowerCase(),
    category: item.category,
    dueDate: item.dueDate?.toISOString() ?? null,
    confidence: item.confidence,
    createdAt: item.createdAt.toISOString(),
  }
})
