import { prisma } from '../../utils/prisma'
import { requireWorkspaceMember, requireMinRole } from '../../utils/auth'
import { createProjectChannel } from '../../utils/channelUtils'
import { getDefaultSubStatus, isValidSubStatusForStatus, normalizeIncomingSubStatus, normalizeItemStatus } from '../../utils/itemStage'
import { checkCanCreateProject } from '../../utils/planLimits'

const MAX_TITLE_LENGTH = 255
const MAX_DESCRIPTION_LENGTH = 10000

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const {
    workspaceId,
    parentId,
    title,
    description,
    category,
    status,
    subStatus,
    dueDate,
    startDate,
    confidence,
    complexity,
    priority,
    assigneeIds,
    stakeholderIds,
  } = body

  if (!workspaceId || !title) {
    throw createError({ statusCode: 400, message: 'workspaceId and title are required' })
  }

  if (title.length > MAX_TITLE_LENGTH) {
    throw createError({ statusCode: 400, message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` })
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw createError({ statusCode: 400, message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)
  requireMinRole(auth, 'MEMBER') // VIEWERs cannot create items
  const user = auth.user

  // Enforce plan limit for root-level projects
  if (!parentId) {
    const check = await checkCanCreateProject(workspaceId)
    if (!check.allowed) {
      throw createError({
        statusCode: 403,
        message: `Project limit reached (${check.current}/${check.limit}). Upgrade your plan to create more projects.`,
      })
    }
  }
  
  // Determine final status and auto-set startDate
  const finalStatus = normalizeItemStatus(status)
  const now = new Date()
  const requestedSubStatus = normalizeIncomingSubStatus(subStatus)
  const finalSubStatus = requestedSubStatus !== undefined && isValidSubStatusForStatus(finalStatus, requestedSubStatus)
    ? requestedSubStatus
    : getDefaultSubStatus(finalStatus)
  
  // Auto-set startDate to now if creating as IN_PROGRESS and no startDate provided
  let finalStartDate = startDate ? new Date(startDate) : null
  if (finalStatus === 'IN_PROGRESS' && !finalStartDate) {
    finalStartDate = now
  }
  
  // Set first assignee as owner by default, fall back to authenticated user
  const ownerId = body.ownerId ?? assigneeIds?.[0] ?? user.id

  // Determine projectId (root project) for efficient queries
  let projectId: string | null = null
  if (parentId) {
    const parent = await prisma.item.findUnique({
      where: { id: parentId },
      select: { projectId: true }
    })
    // If parent has a projectId, use it. Otherwise, parent IS the root project
    projectId = parent?.projectId ?? parentId
  }

  const item = await prisma.item.create({
    data: {
      workspaceId,
      parentId: parentId || null,
      projectId,
      title,
      description,
      category,
      status: finalStatus,
      subStatus: finalSubStatus,
      dueDate: dueDate ? new Date(dueDate) : null,
      startDate: finalStartDate,
      confidence: confidence ?? 70,
      complexity: complexity ?? null,
      priority: priority ?? undefined,
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
          where: { workspaceId, status: 'ACTIVE' },
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
