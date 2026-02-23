import { requireTokenUser, requireAssignedTask } from '../../../../../utils/agentApi'
import { toAttachmentResponse } from '../../../../../utils/attachments'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const taskId = getRouterParam(event, 'id')
  if (!taskId) {
    throw createError({ statusCode: 400, message: 'Task ID is required' })
  }

  const agent = await requireTokenUser(event)
  await requireAssignedTask(agent.id, taskId)

  const attachments = await prisma.attachment.findMany({
    where: { itemId: taskId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  return attachments.map((attachment) =>
    toAttachmentResponse(attachment, attachment.uploadedById === agent.id),
  )
})
