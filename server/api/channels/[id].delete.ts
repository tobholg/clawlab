import { prisma } from '../../utils/prisma'
import { requireWorkspaceMemberForChannel } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  await requireWorkspaceMemberForChannel(event, id)

  const channel = await prisma.channel.findUnique({
    where: { id },
  })

  if (!channel) {
    throw createError({ statusCode: 404, message: 'Channel not found' })
  }

  // Soft delete - set archived to true
  const updated = await prisma.channel.update({
    where: { id },
    data: { archived: true },
  })

  return {
    id: updated.id,
    archived: updated.archived,
    message: 'Channel archived successfully',
  }
})
