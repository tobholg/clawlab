import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../../utils/auth'

type SafeUser = {
  id: string
  name: string
  avatar: string | null
}

const formatUser = (user: { id: string; name: string | null; email: string; avatar: string | null }): SafeUser => ({
  id: user.id,
  name: user.name ?? user.email.split('@')[0],
  avatar: user.avatar,
})

export default defineEventHandler(async (event) => {
  const itemId = getRouterParam(event, 'id')
  if (!itemId) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  await requireWorkspaceMemberForItem(event, itemId)

  const activities = await prisma.activity.findMany({
    where: { itemId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
  })

  const commentIds = activities
    .map((activity) => {
      const metadata = activity.metadata as Record<string, unknown> | null
      const commentId = metadata?.commentId
      return typeof commentId === 'string' ? commentId : null
    })
    .filter((id): id is string => !!id)

  const comments = commentIds.length > 0
    ? await prisma.comment.findMany({
      where: { id: { in: commentIds } },
      select: {
        id: true,
        content: true,
        parentCommentId: true,
      },
    })
    : []

  const commentMap = new Map(comments.map(comment => [comment.id, comment]))

  const assignmentUserIds = activities
    .map((activity) => activity.type === 'ASSIGNMENT' ? activity.newValue : null)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  const assignedUsers = assignmentUserIds.length > 0
    ? await prisma.user.findMany({
      where: { id: { in: assignmentUserIds } },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
      },
    })
    : []

  const assignedUserMap = new Map(assignedUsers.map(user => [user.id, formatUser(user)]))

  return {
    itemId,
    entries: activities.map((activity) => {
      const metadata = activity.metadata as Record<string, unknown> | null
      const commentId = typeof metadata?.commentId === 'string' ? metadata.commentId : null
      const comment = commentId ? commentMap.get(commentId) : null
      const targetUser = activity.type === 'ASSIGNMENT' && activity.newValue
        ? assignedUserMap.get(activity.newValue)
        : null

      return {
        id: activity.id,
        type: activity.type,
        oldValue: activity.oldValue,
        newValue: activity.newValue,
        createdAt: activity.createdAt.toISOString(),
        user: formatUser(activity.user),
        comment: comment ? {
          id: comment.id,
          content: comment.content,
          parentCommentId: comment.parentCommentId,
        } : null,
        targetUser: targetUser ?? null,
      }
    }),
  }
})
