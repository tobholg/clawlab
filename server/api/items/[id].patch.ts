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
    subStatus,
    dueDate,
    startDate,
    confidence,
    progress,
    ownerId,
  } = body
  
  // Get current item to check if we need to auto-set startDate
  const currentItem = await prisma.item.findUnique({
    where: { id },
    select: { status: true, subStatus: true, startDate: true }
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
  
  // Valid sub-statuses per status
  const validSubStatuses: Record<string, string[]> = {
    TODO: ['backlog', 'ready'],
    IN_PROGRESS: ['scoping', 'active', 'review', 'finalizing'],
    BLOCKED: ['dependency', 'external', 'decision'],
    PAUSED: ['on_hold', 'deprioritized'],
    DONE: [], // No sub-statuses, but we preserve the old one
  }
  
  // Handle status change
  if (status !== undefined) {
    const newStatus = status.toUpperCase()
    const oldStatus = currentItem.status
    updateData.status = newStatus
    
    // Only clear subStatus if:
    // 1. subStatus is not explicitly being set in this request
    // 2. Moving between statuses that have different valid sub-statuses
    // 3. NOT moving to/from DONE (preserve subStatus for round-trips through DONE)
    if (subStatus === undefined && newStatus !== oldStatus) {
      const isDoneTransition = newStatus === 'DONE' || oldStatus === 'DONE'
      
      if (!isDoneTransition) {
        // Check if current subStatus is valid for new status
        const currentSubStatus = currentItem.subStatus
        const newValidSubStatuses = validSubStatuses[newStatus] || []
        
        if (currentSubStatus && !newValidSubStatuses.includes(currentSubStatus)) {
          // Current subStatus is not valid for new status, clear it
          updateData.subStatus = null
        }
      }
      // If it's a DONE transition, don't touch subStatus - preserve it
    }
    
    // Auto-set startDate when moving TO in_progress if not already set
    if (newStatus === 'IN_PROGRESS' && currentItem.status !== 'IN_PROGRESS' && !currentItem.startDate) {
      updateData.startDate = now
    }

    // Set completedAt when moving TO done, clear when moving away from done
    if (newStatus === 'DONE' && oldStatus !== 'DONE') {
      updateData.completedAt = now
    } else if (newStatus !== 'DONE' && oldStatus === 'DONE') {
      updateData.completedAt = null
    }
  }
  
  // Handle subStatus change
  if (subStatus !== undefined) {
    updateData.subStatus = subStatus
  }
  
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
  if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
  if (confidence !== undefined) updateData.confidence = confidence
  if (progress !== undefined) updateData.progress = progress
  if (ownerId !== undefined) updateData.ownerId = ownerId || null
  
  const item = await prisma.item.update({
    where: { id },
    data: updateData,
    include: {
      owner: true,
    }
  })

  // Create Activity record for status changes
  if (status !== undefined && status.toUpperCase() !== currentItem.status) {
    // TODO: Get actual userId from auth context - using placeholder for now
    const userId = body.userId || 'system'

    await prisma.activity.create({
      data: {
        itemId: id,
        userId,
        type: 'STATUS_CHANGE',
        oldValue: currentItem.status.toLowerCase(),
        newValue: status.toLowerCase(),
      }
    })
  }

  return {
    id: item.id,
    title: item.title,
    status: item.status.toLowerCase(),
    subStatus: item.subStatus ?? null,
    startDate: item.startDate?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
    owner: item.owner ? {
      id: item.owner.id,
      name: item.owner.name,
      avatar: item.owner.avatar,
    } : null,
  }
})
