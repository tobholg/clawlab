import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { requireUser, requireWorkspaceMember } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { getFilePath } from '../../utils/storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Attachment ID is required' })
  }

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: {
      item: {
        select: { workspaceId: true },
      },
      message: {
        select: { channelId: true },
      },
    },
  })

  if (!attachment) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  if (attachment.item) {
    await requireWorkspaceMember(event, attachment.item.workspaceId)
  } else if (attachment.message) {
    const user = await requireUser(event)
    const membership = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId: attachment.message.channelId,
          userId: user.id,
        },
      },
      select: { id: true },
    })

    if (!membership) {
      throw createError({ statusCode: 403, statusMessage: 'Channel access required' })
    }
  } else {
    const user = await requireUser(event)
    if (attachment.uploadedById !== user.id) {
      throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
    }
  }

  const absolutePath = getFilePath(attachment.storagePath)
  let fileStats
  try {
    fileStats = await stat(absolutePath)
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  const mimeType = attachment.mimeType || 'application/octet-stream'
  const isImage = mimeType.startsWith('image/')
  const dispositionType = isImage ? 'inline' : 'attachment'
  const safeFilename = attachment.name.replace(/["\\\r\n]/g, '_')

  setResponseHeader(event, 'Content-Type', mimeType)
  setResponseHeader(event, 'Content-Length', String(fileStats.size))
  setResponseHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  setResponseHeader(event, 'Content-Disposition', `${dispositionType}; filename="${safeFilename || 'file'}"`)

  return sendStream(event, createReadStream(absolutePath))
})
