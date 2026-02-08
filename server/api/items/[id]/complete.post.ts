import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../../utils/auth'
import { requireItemPermission } from '../../../utils/permissions'
import { collectDescendants, countIncompleteDescendants } from '../../../utils/itemCompletion'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)
  const cascade = Boolean(body?.cascade)
  const maxDepth = typeof body?.maxDepth === 'number' ? body.maxDepth : 5

  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  const auth = await requireWorkspaceMemberForItem(event, id)
  await requireItemPermission(auth, id, 'change_status')

  const item = await prisma.item.findUnique({
    where: { id },
    select: { id: true, status: true }
  })

  if (!item) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }

  if (!cascade) {
    const incompleteDescendants = await countIncompleteDescendants(prisma, id)
    if (incompleteDescendants > 0) {
      throw createError({
        statusCode: 400,
        message: 'Cannot mark this item as done while it has incomplete child tasks.',
      })
    }
  }

  const { descendants, truncated } = await collectDescendants(prisma, id, maxDepth)
  const incomplete = descendants.filter((child) => child.status !== 'DONE')

  if (cascade && truncated) {
    throw createError({
      statusCode: 400,
      message: 'This item has subtasks deeper than 5 levels. Please complete them manually.',
    })
  }

  const now = new Date()

  if (cascade && incomplete.length > 0) {
    await prisma.item.updateMany({
      where: { id: { in: incomplete.map((child) => child.id) } },
      data: {
        status: 'DONE',
        subStatus: null,
        progress: 100,
        completedAt: now,
        updatedAt: now,
        lastActivityAt: now,
      }
    })
  }

  await prisma.item.update({
    where: { id },
    data: {
      status: 'DONE',
      subStatus: null,
      progress: 100,
      completedAt: now,
      updatedAt: now,
      lastActivityAt: now,
    }
  })

  return {
    success: true,
    completedDescendants: incomplete.length,
    truncated,
  }
})
