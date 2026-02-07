import { prisma } from '../../utils/prisma'
import { countIncompleteDescendants } from '../../utils/itemCompletion'
import { getDefaultSubStatus, isValidSubStatusForStatus, normalizeIncomingSubStatus, normalizeItemStatus, type ItemStatusValue } from '../../utils/itemStage'

// Helper: Check if targetId is a descendant of itemId (prevent circular refs)
async function isDescendant(itemId: string, targetId: string): Promise<boolean> {
  const children = await prisma.item.findMany({
    where: { parentId: itemId },
    select: { id: true }
  })

  for (const child of children) {
    if (child.id === targetId) return true
    if (await isDescendant(child.id, targetId)) return true
  }

  return false
}

// Helper: Recursively update projectId for all descendants
async function updateDescendantsProjectId(itemId: string, newProjectId: string | null): Promise<void> {
  const children = await prisma.item.findMany({
    where: { parentId: itemId },
    select: { id: true }
  })

  for (const child of children) {
    await prisma.item.update({
      where: { id: child.id },
      data: { projectId: newProjectId }
    })
    await updateDescendantsProjectId(child.id, newProjectId)
  }
}

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
    complexity,
    priority,
    ownerId,
    parentId,
  } = body

  // Get current item with hierarchy info
  const currentItem = await prisma.item.findUnique({
    where: { id },
    select: { status: true, subStatus: true, startDate: true, parentId: true, projectId: true, workspaceId: true }
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
  if (complexity !== undefined) updateData.complexity = complexity
  if (priority !== undefined) updateData.priority = priority || null
  
  const oldStatus = currentItem.status as ItemStatusValue
  const requestedStatus = status !== undefined ? normalizeItemStatus(status, oldStatus) : oldStatus
  const statusChanged = requestedStatus !== oldStatus

  // Handle status change
  if (status !== undefined) {
    if (requestedStatus === 'DONE' && oldStatus !== 'DONE') {
      const incompleteDescendants = await countIncompleteDescendants(prisma, id)
      if (incompleteDescendants > 0) {
        throw createError({
          statusCode: 400,
          message: 'Cannot mark this item as done while it has incomplete child tasks.',
        })
      }
    }

    updateData.status = requestedStatus
    
    // Auto-set startDate when moving TO in_progress if not already set
    if (requestedStatus === 'IN_PROGRESS' && oldStatus !== 'IN_PROGRESS' && !currentItem.startDate) {
      updateData.startDate = now
    }

    // Set completedAt when moving TO done, clear when moving away from done
    if (requestedStatus === 'DONE' && oldStatus !== 'DONE') {
      updateData.completedAt = now
    } else if (requestedStatus !== 'DONE' && oldStatus === 'DONE') {
      updateData.completedAt = null
    }
  }
  
  // Handle subStatus with status-aware defaults
  const requestedSubStatus = normalizeIncomingSubStatus(subStatus)
  if (status !== undefined) {
    if (requestedStatus === 'DONE') {
      updateData.subStatus = null
    } else if (requestedSubStatus === undefined) {
      if (statusChanged) {
        updateData.subStatus = getDefaultSubStatus(requestedStatus)
      }
    } else if (requestedSubStatus === null) {
      // Enforce default stages on status transitions; allow "None" only for TODO when status stays TODO.
      updateData.subStatus = statusChanged
        ? getDefaultSubStatus(requestedStatus)
        : (requestedStatus === 'TODO' ? null : getDefaultSubStatus(requestedStatus))
    } else if (isValidSubStatusForStatus(requestedStatus, requestedSubStatus)) {
      updateData.subStatus = requestedSubStatus
    } else {
      updateData.subStatus = getDefaultSubStatus(requestedStatus)
    }
  } else if (subStatus !== undefined) {
    // Status unchanged: normalize to a valid stage for current status.
    if (requestedSubStatus === null) {
      updateData.subStatus = oldStatus === 'TODO' || oldStatus === 'DONE'
        ? null
        : getDefaultSubStatus(oldStatus)
    } else if (requestedSubStatus && isValidSubStatusForStatus(oldStatus, requestedSubStatus)) {
      updateData.subStatus = requestedSubStatus
    } else {
      updateData.subStatus = getDefaultSubStatus(oldStatus)
    }
  }
  
  if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
  if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null
  if (confidence !== undefined) updateData.confidence = confidence
  if (progress !== undefined) updateData.progress = progress
  if (ownerId !== undefined) updateData.ownerId = ownerId || null

  // Handle parentId change (reparenting)
  let needsDescendantUpdate = false
  let newProjectId: string | null = null

  if (parentId !== undefined && parentId !== currentItem.parentId) {
    // Validate: cannot set parentId to self
    if (parentId === id) {
      throw createError({ statusCode: 400, message: 'Item cannot be its own parent' })
    }

    // Validate: cannot set parentId to a descendant (circular reference)
    if (parentId !== null && await isDescendant(id, parentId)) {
      throw createError({ statusCode: 400, message: 'Cannot move item under its own descendant' })
    }

    // If setting a new parent, validate it exists and is in same workspace
    if (parentId !== null) {
      const newParent = await prisma.item.findUnique({
        where: { id: parentId },
        select: { id: true, workspaceId: true, projectId: true }
      })

      if (!newParent) {
        throw createError({ statusCode: 404, message: 'New parent item not found' })
      }

      if (newParent.workspaceId !== currentItem.workspaceId) {
        throw createError({ statusCode: 400, message: 'Cannot move item to a different workspace' })
      }

      // Calculate new projectId:
      // - If parent has projectId, use it (parent is nested)
      // - If parent's projectId is null, parent IS the root project, so use parentId
      newProjectId = newParent.projectId ?? parentId
    } else {
      // Moving to root level (no parent)
      newProjectId = null
    }

    updateData.parentId = parentId
    updateData.projectId = newProjectId
    needsDescendantUpdate = true
  }

  const item = await prisma.item.update({
    where: { id },
    data: updateData,
    include: {
      owner: true,
    }
  })

  // Update all descendants' projectId if this item was reparented
  if (needsDescendantUpdate) {
    await updateDescendantsProjectId(id, newProjectId)
  }

  // Create Activity record for status changes
  if (status !== undefined && statusChanged) {
    // TODO: Get actual userId from auth context - using placeholder for now
    const userId = body.userId || 'system'

    await prisma.activity.create({
      data: {
        itemId: id,
        userId,
        type: 'STATUS_CHANGE',
        oldValue: oldStatus.toLowerCase(),
        newValue: requestedStatus.toLowerCase(),
      }
    })
  }

  return {
    id: item.id,
    title: item.title,
    status: item.status.toLowerCase(),
    subStatus: item.subStatus ?? null,
    parentId: item.parentId ?? null,
    projectId: item.projectId ?? null,
    startDate: item.startDate?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
    owner: item.owner ? {
      id: item.owner.id,
      name: item.owner.name,
      avatar: item.owner.avatar,
    } : null,
  }
})
