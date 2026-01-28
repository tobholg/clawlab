import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  
  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }
  
  const { 
    title, 
    description, 
    category,
    status,
    dueDate,
    startDate,
    confidence,
    progress,
  } = body
  
  // Get current item to check if we need to auto-set startDate
  const currentItem = await prisma.item.findUnique({
    where: { id },
    select: { status: true, startDate: true }
  })
  
  if (!currentItem) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }
  
  const now = new Date()
  const updateData: any = {
    lastActivityAt: now,
  }
  
  if (title !== undefined) updateData.title = title
  if (description !== undefined) updateData.description = description
  if (category !== undefined) updateData.category = category
  
  // Handle status change
  if (status !== undefined) {
    const newStatus = status.toUpperCase()
    updateData.status = newStatus
    
    // Auto-set startDate when moving TO in_progress if not already set
    if (newStatus === 'IN_PROGRESS' && currentItem.status !== 'IN_PROGRESS' && !currentItem.startDate) {
      updateData.startDate = now
    }
  }
  
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
  if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
  if (confidence !== undefined) updateData.confidence = confidence
  if (progress !== undefined) updateData.progress = progress
  
  const item = await prisma.item.update({
    where: { id },
    data: updateData,
  })
  
  return {
    id: item.id,
    title: item.title,
    status: item.status.toLowerCase(),
    startDate: item.startDate?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
  }
})
