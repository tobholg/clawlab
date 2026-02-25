import { prisma } from '../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../utils/auth'
import { requireItemPermission } from '../../utils/permissions'
import { countIncompleteDescendants } from '../../utils/itemCompletion'
import { getDefaultSubStatus, isValidSubStatusForStatus, normalizeIncomingSubStatus, normalizeItemStatus, type ItemStatusValue } from '../../utils/itemStage'

const MAX_TITLE_LENGTH = 255
const MAX_DESCRIPTION_LENGTH = 10000

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

  const auth = await requireWorkspaceMemberForItem(event, id)
  await requireItemPermission(auth, id, 'edit')
  const { user } = auth

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
    repoUrl,
    repoPath,
    defaultBranch,
    ownerId,
    parentId,
    itemType,
    agentMode,
    acceptedPlanVersion,
  } = body

  if (title !== undefined && title.length > MAX_TITLE_LENGTH) {
    throw createError({ statusCode: 400, message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` })
  }

  if (description !== undefined && description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw createError({ statusCode: 400, message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` })
  }

  // Get current item with hierarchy info
  const currentItem = await prisma.item.findUnique({
    where: { id },
    select: { status: true, subStatus: true, startDate: true, parentId: true, projectId: true, workspaceId: true, agentMode: true, itemType: true }
  })

  if (!currentItem) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }
  
  const now = new Date()
  const updateData: any = {
    lastActivityAt: now,
  }

  let normalizedItemType: 'TASK' | 'WORKSTREAM' | undefined
  if (itemType !== undefined) {
    const rawType = typeof itemType === 'string' ? itemType.trim().toUpperCase() : ''
    if (!['TASK', 'WORKSTREAM'].includes(rawType)) {
      throw createError({ statusCode: 400, message: 'itemType must be TASK or WORKSTREAM' })
    }
    normalizedItemType = rawType as 'TASK' | 'WORKSTREAM'
    updateData.itemType = normalizedItemType
    if (normalizedItemType === 'WORKSTREAM') {
      // Workstreams are structural containers and should not run agent workflows directly.
      updateData.agentMode = null
    }
  }
  
  if (title !== undefined) updateData.title = title
  if (description !== undefined) updateData.description = description
  if (category !== undefined) updateData.category = category
  if (complexity !== undefined) updateData.complexity = complexity
  if (priority !== undefined) updateData.priority = priority || null
  if (repoUrl !== undefined) updateData.repoUrl = typeof repoUrl === 'string' && repoUrl.trim() ? repoUrl.trim() : null
  if (repoPath !== undefined) updateData.repoPath = typeof repoPath === 'string' && repoPath.trim() ? repoPath.trim() : null
  if (defaultBranch !== undefined) updateData.defaultBranch = typeof defaultBranch === 'string' && defaultBranch.trim() ? defaultBranch.trim() : null
  
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

  if (acceptedPlanVersion !== undefined) {
    if (acceptedPlanVersion === null) {
      updateData.acceptedPlanVersion = null
    } else if (typeof acceptedPlanVersion === 'number' && Number.isInteger(acceptedPlanVersion) && acceptedPlanVersion > 0) {
      updateData.acceptedPlanVersion = acceptedPlanVersion
    } else {
      throw createError({ statusCode: 400, message: 'acceptedPlanVersion must be a positive integer or null' })
    }
  }

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

  // Root-level items are structural containers in this model.
  const effectiveParentId = parentId !== undefined ? parentId : currentItem.parentId
  if (effectiveParentId === null) {
    updateData.itemType = 'WORKSTREAM'
    normalizedItemType = 'WORKSTREAM'
  }

  // Agent mode management (human-only)
  if (agentMode !== undefined) {
    const effectiveItemType = (updateData.itemType ?? currentItem.itemType) as 'TASK' | 'WORKSTREAM'
    if (effectiveItemType === 'WORKSTREAM' && agentMode !== null) {
      throw createError({ statusCode: 400, message: 'Workstream items cannot have agentMode set' })
    }
    if (agentMode === null) {
      updateData.agentMode = null
    } else {
      const normalized = String(agentMode).toUpperCase()
      if (!['PLAN', 'EXECUTE', 'COMPLETED'].includes(normalized)) {
        throw createError({ statusCode: 400, message: 'agentMode must be PLAN, EXECUTE, COMPLETED, or null' })
      }
      updateData.agentMode = normalized
    }
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
    await prisma.activity.create({
      data: {
        itemId: id,
        userId: user.id,
        type: 'STATUS_CHANGE',
        oldValue: oldStatus.toLowerCase(),
        newValue: requestedStatus.toLowerCase(),
      }
    })
  }

  // Create activity for agentMode changes
  if (agentMode !== undefined) {
    const oldMode = currentItem.agentMode ?? null
    const newMode = updateData.agentMode ?? null
    if (oldMode !== newMode) {
      await prisma.activity.create({
        data: {
          itemId: id,
          userId: user.id,
          type: 'UPDATED',
          oldValue: oldMode,
          newValue: newMode,
        }
      })
    }
  }

  return {
    id: item.id,
    title: item.title,
    status: item.status.toLowerCase(),
    subStatus: item.subStatus ?? null,
    itemType: item.itemType.toLowerCase(),
    parentId: item.parentId ?? null,
    projectId: item.projectId ?? null,
    agentMode: item.agentMode ?? null,
    repoUrl: item.repoUrl ?? null,
    repoPath: item.repoPath ?? null,
    defaultBranch: item.defaultBranch ?? null,
    planDocId: item.planDocId ?? null,
    acceptedPlanVersion: item.acceptedPlanVersion ?? null,
    startDate: item.startDate?.toISOString() ?? null,
    updatedAt: item.updatedAt.toISOString(),
    owner: item.owner ? {
      id: item.owner.id,
      name: item.owner.name,
      avatar: item.owner.avatar,
    } : null,
  }
})
