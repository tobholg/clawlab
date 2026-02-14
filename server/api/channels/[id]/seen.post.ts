import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForChannel } from '../../../utils/auth'

interface MarkSeenBody {
  seenAt?: string
}

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id')

  if (!channelId) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  const { user } = await requireWorkspaceMemberForChannel(event, channelId)
  const body = await readBody<MarkSeenBody>(event)

  const parsedSeenAt = body?.seenAt ? new Date(body.seenAt) : new Date()
  if (Number.isNaN(parsedSeenAt.getTime())) {
    throw createError({ statusCode: 400, message: 'Invalid seenAt timestamp' })
  }

  const now = new Date()
  const lastSeenAt = parsedSeenAt > now ? now : parsedSeenAt
  const existingReadState = await prisma.channelReadState.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId: user.id,
      },
    },
    select: {
      lastSeenAt: true,
    },
  })

  const effectiveLastSeenAt =
    existingReadState && existingReadState.lastSeenAt > lastSeenAt
      ? existingReadState.lastSeenAt
      : lastSeenAt

  const readState = await prisma.channelReadState.upsert({
    where: {
      channelId_userId: {
        channelId,
        userId: user.id,
      },
    },
    update: {
      lastSeenAt: effectiveLastSeenAt,
    },
    create: {
      channelId,
      userId: user.id,
      lastSeenAt: effectiveLastSeenAt,
    },
    select: {
      lastSeenAt: true,
      updatedAt: true,
    },
  })

  return {
    channelId,
    userId: user.id,
    lastSeenAt: readState.lastSeenAt.toISOString(),
    updatedAt: readState.updatedAt.toISOString(),
  }
})
