import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Document ID is required' })
  }

  const body = await readBody(event)
  const { title, content, isLocked, userId } = body

  const data: { title?: string; content?: string; isLocked?: boolean; lastEditedById?: string | null } = {}

  if (title !== undefined) data.title = title?.toString() ?? ''
  if (content !== undefined) data.content = content?.toString() ?? ''
  if (isLocked !== undefined) data.isLocked = !!isLocked
  if (userId !== undefined) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (user) data.lastEditedById = userId
  }

  const document = await prisma.document.update({
    where: { id },
    data,
    include: {
      createdBy: true,
      lastEditedBy: true,
      _count: { select: { versions: true } },
    },
  })

  return {
    id: document.id,
    itemId: document.itemId,
    projectId: document.projectId,
    title: document.title,
    content: document.content,
    isLocked: document.isLocked,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    createdBy: document.createdBy ? {
      id: document.createdBy.id,
      name: document.createdBy.name ?? document.createdBy.email.split('@')[0],
      avatar: document.createdBy.avatar,
    } : null,
    lastEditedBy: document.lastEditedBy ? {
      id: document.lastEditedBy.id,
      name: document.lastEditedBy.name ?? document.lastEditedBy.email.split('@')[0],
      avatar: document.lastEditedBy.avatar,
    } : null,
    versionCount: document._count.versions,
  }
})
