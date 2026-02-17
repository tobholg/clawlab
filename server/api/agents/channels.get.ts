import { prisma } from '../../utils/prisma'
import { requireAgentUser } from '../../utils/agentApi'

export default defineEventHandler(async (event) => {
  const agent = requireAgentUser(event)

  const memberships = await prisma.channelMember.findMany({
    where: {
      userId: agent.id,
      channel: {
        archived: false,
      },
    },
    select: {
      channel: {
        select: {
          id: true,
          name: true,
          displayName: true,
          projectId: true,
          type: true,
          readStates: {
            where: { userId: agent.id },
            select: { lastSeenAt: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  const channels = await Promise.all(
    memberships.map(async (membership) => {
      const channel = membership.channel
      const lastSeenAt = channel.readStates[0]?.lastSeenAt

      const unreadMentions = await prisma.messageMention.count({
        where: {
          userId: agent.id,
          message: {
            channelId: channel.id,
            deleted: false,
            ...(lastSeenAt ? { createdAt: { gt: lastSeenAt } } : {}),
          },
        },
      })

      return {
        id: channel.id,
        name: channel.name,
        displayName: channel.displayName ?? channel.name,
        projectId: channel.projectId,
        type: channel.type.toLowerCase(),
        unreadMentions,
      }
    }),
  )

  return { channels }
})
