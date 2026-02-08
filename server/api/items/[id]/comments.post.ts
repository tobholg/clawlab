import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../../utils/auth'

const MAX_COMMENT_LENGTH = 5000

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  const { content, parentCommentId } = body

  if (!content?.trim()) {
    throw createError({ statusCode: 400, message: 'Comment content is required' })
  }

  if (content.length > MAX_COMMENT_LENGTH) {
    throw createError({ statusCode: 400, message: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer` })
  }

  const { user } = await requireWorkspaceMemberForItem(event, id)

  // Verify item exists
  const item = await prisma.item.findUnique({ where: { id } })
  if (!item) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }

  // If replying, verify parent comment exists and belongs to same item
  if (parentCommentId) {
    const parentComment = await prisma.comment.findUnique({
      where: { id: parentCommentId }
    })
    if (!parentComment || parentComment.itemId !== id) {
      throw createError({ statusCode: 400, message: 'Invalid parent comment' })
    }
  }

  // Create the comment
  const comment = await prisma.comment.create({
    data: {
      itemId: id,
      userId: user.id,
      content: content.trim(),
      parentCommentId: parentCommentId || null,
    },
    include: {
      user: true,
    }
  })

  // Update item's lastActivityAt
  await prisma.item.update({
    where: { id },
    data: { lastActivityAt: new Date() }
  })

  // Create activity log
  await prisma.activity.create({
    data: {
      itemId: id,
      userId: user.id,
      type: 'COMMENT',
      metadata: { commentId: comment.id }
    }
  })

  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    user: comment.user ? {
      id: comment.user.id,
      name: comment.user.name ?? comment.user.email.split('@')[0],
      avatar: comment.user.avatar,
    } : null,
    parentCommentId: comment.parentCommentId,
  }
})
