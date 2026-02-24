import { extension as mimeExtension } from 'mime-types'
import { requireTokenUser, requireAssignedTask } from '../../../../../utils/agentApi'
import { toAttachmentResponse } from '../../../../../utils/attachments'
import { prisma } from '../../../../../utils/prisma'
import { deleteFile, saveFile, UPLOAD_MAX_SIZE } from '../../../../../utils/storage'
import { checkCanUploadFile } from '../../../../../utils/uploadLimits'

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
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const agent = await requireTokenUser(event)
  await requireAssignedTask(agent.id, taskId)

  const parts = await readMultipartFormData(event)
  if (!parts?.length) {
    throw createError({ statusCode: 400, message: 'multipart/form-data is required' })
  }

  const filePart = parts.find((part) => part.name === 'file' && part.data && part.data.length > 0)
  if (!filePart?.data) {
    throw createError({ statusCode: 400, message: 'file is required' })
  }

  if (filePart.data.byteLength > UPLOAD_MAX_SIZE) {
    throw createError({
      statusCode: 413,
      message: `File exceeds maximum size of ${UPLOAD_MAX_SIZE} bytes`,
    })
  }

  const uploadCheck = await checkCanUploadFile(agent.id, filePart.data.byteLength)
  if (!uploadCheck.allowed) {
    throw createError({
      statusCode: 429,
      message: `Upload quota exceeded in the last 24h (${uploadCheck.current}/${uploadCheck.limit} bytes).`,
    })
  }

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
        itemId: taskId,
        uploadedById: agent.id,
      },
    })

    return toAttachmentResponse(attachment, true)
  } catch (error) {
    await deleteFile(stored.storagePath)
    throw error
  }
})
