import { requireWorkspaceMember } from '../../utils/auth'
import { prisma } from '../../utils/prisma'
import { deleteFile } from '../../utils/storage'

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
    },
  })

  if (!attachment || !attachment.item) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  const auth = await requireWorkspaceMember(event, attachment.item.workspaceId)
  const canDelete = auth.isWorkspaceAdmin || attachment.uploadedById === auth.user.id
  if (!canDelete) {
    throw createError({ statusCode: 403, statusMessage: 'Only uploader or workspace admin can delete attachment' })
  }

  await prisma.attachment.delete({
    where: { id: attachment.id },
  })

  await deleteFile(attachment.storagePath)

  return { success: true }
})
