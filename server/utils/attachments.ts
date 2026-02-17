type AttachmentRecord = {
  id: string
  name: string
  mimeType: string | null
  sizeBytes: number
  metadata: unknown
  uploadedById: string
  createdAt: Date
}

export type MessageAttachmentRecord = {
  id: string
  name: string
  mimeType: string | null
  sizeBytes: number
  metadata: unknown
  createdAt: Date
}

export const messageAttachmentSelect = {
  id: true,
  name: true,
  mimeType: true,
  sizeBytes: true,
  metadata: true,
  createdAt: true,
} as const

export function toAttachmentResponse(attachment: AttachmentRecord, canDelete = false) {
  const mimeType = attachment.mimeType || 'application/octet-stream'
  const isImage = mimeType.startsWith('image/')
  const url = `/api/files/${attachment.id}`

  return {
    id: attachment.id,
    name: attachment.name,
    mimeType,
    sizeBytes: attachment.sizeBytes,
    url,
    thumbUrl: isImage ? url : null,
    metadata: attachment.metadata ?? null,
    uploadedById: attachment.uploadedById,
    canDelete,
    createdAt: attachment.createdAt.toISOString(),
  }
}

export function toMessageAttachmentResponse(attachment: MessageAttachmentRecord) {
  return {
    id: attachment.id,
    name: attachment.name,
    mimeType: attachment.mimeType || 'application/octet-stream',
    sizeBytes: attachment.sizeBytes,
    metadata: attachment.metadata ?? null,
    createdAt: attachment.createdAt.toISOString(),
  }
}
