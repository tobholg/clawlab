import { requireWorkspaceMemberForItem } from '../../../utils/auth'
import { toAttachmentResponse } from '../../../utils/attachments'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const itemId = getRouterParam(event, 'id')
  if (!itemId) {
    throw createError({ statusCode: 400, statusMessage: 'Item ID is required' })
  }

  const auth = await requireWorkspaceMemberForItem(event, itemId)

  const attachments = await prisma.attachment.findMany({
    where: { itemId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  return attachments.map((attachment) =>
    toAttachmentResponse(attachment, auth.isWorkspaceAdmin || attachment.uploadedById === auth.user.id),
  )
})
