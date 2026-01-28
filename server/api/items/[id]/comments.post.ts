import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  
  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }
  
  const { content, parentCommentId, userId } = body
  
  if (!content?.trim()) {
    throw createError({ statusCode: 400, message: 'Comment content is required' })
  }
  
  // Use provided userId or default to demo user
  const effectiveUserId = userId || 'demo-user'
  
  // Ensure user exists
  let user = await prisma.user.findUnique({ where: { id: effectiveUserId } })
  if (!user) {
    user = await prisma.user.create({
      data: {
        id: effectiveUserId,
        email: `${effectiveUserId}@demo.local`,
        name: 'Demo User',
      }
    })
  }
  
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
      userId: effectiveUserId,
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
      userId: effectiveUserId,
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
