import { prisma } from '../../../../../utils/prisma'
import { getDisplayName, requireAgentUser, requireAssignedTask } from '../../../../../utils/agentApi'

const MAX_TITLE_LENGTH = 255

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  const docId = getRouterParam(event, 'docId')

  if (!taskId || !docId) {
    throw createError({ statusCode: 400, message: 'Task ID and doc ID are required' })
  }

  const body = await readBody(event)
  const { title, content, versionLabel, versionType } = body

  if (title === undefined && content === undefined) {
    throw createError({ statusCode: 400, message: 'title or content is required' })
  }

  const nextTitle = title === undefined ? undefined : String(title).trim()
  if (nextTitle !== undefined && nextTitle.length > MAX_TITLE_LENGTH) {
    throw createError({ statusCode: 400, message: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` })
  }

  const normalizedVersionType =
    typeof versionType === 'string' && versionType.toUpperCase() === 'MAJOR' ? 'MAJOR' : 'MINOR'

  const agent = requireAgentUser(event)
  await requireAssignedTask(agent.id, taskId)

  const existingDoc = await prisma.document.findFirst({
    where: {
      id: docId,
      itemId: taskId,
    },
    select: {
      id: true,
      title: true,
      content: true,
    },
  })

  if (!existingDoc) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  const now = new Date()
  const updated = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.update({
      where: { id: docId },
      data: {
        ...(nextTitle !== undefined ? { title: nextTitle } : {}),
        ...(content !== undefined ? { content: String(content) } : {}),
        lastEditedById: agent.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
        lastEditedBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
    })

    const version = await tx.documentVersion.create({
      data: {
        documentId: doc.id,
        title: doc.title,
        content: doc.content,
        label: typeof versionLabel === 'string' && versionLabel.trim().length > 0 ? versionLabel.trim() : null,
        type: normalizedVersionType,
        createdById: agent.id,
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true, avatar: true } },
      },
    })

    await tx.item.update({
      where: { id: taskId },
      data: { lastActivityAt: now },
    })

    return {
      doc,
      version,
    }
  })

  return {
    id: updated.doc.id,
    itemId: updated.doc.itemId,
    projectId: updated.doc.projectId,
    title: updated.doc.title,
    content: updated.doc.content,
    isLocked: updated.doc.isLocked,
    createdAt: updated.doc.createdAt.toISOString(),
    updatedAt: updated.doc.updatedAt.toISOString(),
    createdBy: {
      id: updated.doc.createdBy.id,
      name: getDisplayName(updated.doc.createdBy),
      avatar: updated.doc.createdBy.avatar,
    },
    lastEditedBy: updated.doc.lastEditedBy
      ? {
          id: updated.doc.lastEditedBy.id,
          name: getDisplayName(updated.doc.lastEditedBy),
          avatar: updated.doc.lastEditedBy.avatar,
        }
      : null,
    latestVersion: {
      id: updated.version.id,
      title: updated.version.title,
      content: updated.version.content,
      label: updated.version.label,
      type: updated.version.type,
      createdAt: updated.version.createdAt.toISOString(),
      createdBy: {
        id: updated.version.createdBy.id,
        name: getDisplayName(updated.version.createdBy),
        avatar: updated.version.createdBy.avatar,
      },
    },
  }
})
