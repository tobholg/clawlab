import { prisma } from '../../utils/prisma'

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
      assignees: assigneeIds?.length ? {
        create: assigneeIds.map((userId: string) => ({ userId }))
      } : undefined,
      stakeholders: stakeholderIds?.length ? {
        create: stakeholderIds.map((userId: string) => ({ userId }))
      } : undefined,
    },
    include: {
      assignees: { include: { user: true } },
      stakeholders: { include: { user: true } },
    }
  })
  
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
