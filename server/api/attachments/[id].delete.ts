import { requireUser, requireWorkspaceMember } from '../../utils/auth'
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
      message: {
        select: {
          channelId: true,
          channel: {
            select: { workspaceId: true },
          },
        },
      },
    },
  })

  if (!attachment) {
    throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
  }

  let canDelete = false

  if (attachment.item) {
    const auth = await requireWorkspaceMember(event, attachment.item.workspaceId)
    canDelete = auth.isWorkspaceAdmin || attachment.uploadedById === auth.user.id
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

    if (attachment.uploadedById === user.id) {
      canDelete = true
    } else {
      const auth = await requireWorkspaceMember(event, attachment.message.channel.workspaceId)
      canDelete = auth.isWorkspaceAdmin
    }
  } else {
    const user = await requireUser(event)
    canDelete = attachment.uploadedById === user.id
  }

  if (!canDelete) {
    throw createError({ statusCode: 403, statusMessage: 'Only uploader or workspace admin can delete attachment' })
  }

  await prisma.attachment.delete({
    where: { id: attachment.id },
  })

  await deleteFile(attachment.storagePath)

  return { success: true }
})
