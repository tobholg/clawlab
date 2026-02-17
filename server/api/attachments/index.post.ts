import { extension as mimeExtension } from 'mime-types'
import { requireWorkspaceMemberForItem } from '../../utils/auth'
import { toAttachmentResponse } from '../../utils/attachments'
import { prisma } from '../../utils/prisma'
import { deleteFile, saveFile, UPLOAD_MAX_SIZE } from '../../utils/storage'

function parseTextPart(part: { data?: Uint8Array } | undefined) {
  if (!part?.data) return ''
  return Buffer.from(part.data).toString('utf-8').trim()
}

function normalizeFilename(filename: string | undefined, mimeType: string | undefined) {
  const safeName = (filename || '')
    .split(/[\\/]/)
    .pop()
    ?.trim()

  if (safeName) return safeName.slice(0, 255)

  const ext = typeof mimeType === 'string' ? mimeExtension(mimeType) : false
  return ext ? `upload.${ext}` : 'upload.bin'
}

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, statusMessage: 'multipart/form-data is required' })
  }

  const filePart = parts.find((part) => part.name === 'file' && part.data && part.data.length > 0)
  const itemId = parseTextPart(parts.find((part) => part.name === 'itemId'))

  if (!filePart?.data) {
    throw createError({ statusCode: 400, statusMessage: 'file is required' })
  }

  if (!itemId) {
    throw createError({ statusCode: 400, statusMessage: 'itemId is required' })
  }

  if (filePart.data.byteLength > UPLOAD_MAX_SIZE) {
    throw createError({
      statusCode: 413,
      statusMessage: `File exceeds maximum size of ${UPLOAD_MAX_SIZE} bytes`,
    })
  }

  const auth = await requireWorkspaceMemberForItem(event, itemId)
  const originalName = normalizeFilename(filePart.filename, filePart.type)

  const stored = await saveFile(Buffer.from(filePart.data), originalName)
  const mimeType = typeof filePart.type === 'string' && filePart.type.trim().length > 0
    ? filePart.type
    : stored.mimeType

  try {
    const attachment = await prisma.attachment.create({
      data: {
        type: 'FILE',
        name: originalName,
        mimeType,
        sizeBytes: stored.sizeBytes,
        storagePath: stored.storagePath,
        metadata: stored.metadata ?? undefined,
        itemId,
        uploadedById: auth.user.id,
      },
    })

    return toAttachmentResponse(attachment, true)
  } catch (error) {
    await deleteFile(stored.storagePath)
    throw error
  }
})
