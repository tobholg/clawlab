import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

const MAX_TITLE_LENGTH = 255

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Document ID is required' })
  }

  const user = await requireUser(event)

  // Load document to find its workspace
  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true, itemId: true, item: { select: { workspaceId: true } } },
  })

  if (!document) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  // Verify active workspace membership
  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: { workspaceId: document.item.workspaceId, userId: user.id },
    },
    select: { status: true },
  })
  if (!membership || membership.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, message: 'You are not an active member of this workspace' })
  }

  const body = await readBody(event)
  const { title, content, isLocked } = body

  if (title !== undefined && title && title.toString().length > MAX_TITLE_LENGTH) {
    throw createError({ statusCode: 400, message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` })
  }

  const data: { title?: string; content?: string; isLocked?: boolean; lastEditedById?: string } = {}

  if (title !== undefined) data.title = title?.toString() ?? ''
  if (content !== undefined) data.content = content?.toString() ?? ''
  if (isLocked !== undefined) data.isLocked = !!isLocked
  data.lastEditedById = user.id

  const updated = await prisma.document.update({
    where: { id },
    data,
    include: {
      createdBy: true,
      lastEditedBy: true,
      _count: { select: { versions: true } },
    },
  })

  return {
    id: updated.id,
    itemId: updated.itemId,
    projectId: updated.projectId,
    title: updated.title,
    content: updated.content,
    isLocked: updated.isLocked,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    createdBy: updated.createdBy ? {
      id: updated.createdBy.id,
      name: updated.createdBy.name ?? updated.createdBy.email.split('@')[0],
      avatar: updated.createdBy.avatar,
    } : null,
    lastEditedBy: updated.lastEditedBy ? {
      id: updated.lastEditedBy.id,
      name: updated.lastEditedBy.name ?? updated.lastEditedBy.email.split('@')[0],
      avatar: updated.lastEditedBy.avatar,
    } : null,
    versionCount: updated._count.versions,
  }
})
