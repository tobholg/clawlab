import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Document ID is required' })
  }

  const body = await readBody(event)
  const { label, notes, type, userId, content, title } = body

  const document = await prisma.document.findUnique({
    where: { id },
    select: { title: true, content: true, createdById: true },
  })

  if (!document) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  let creatorId = userId as string | undefined
  if (creatorId) {
    const user = await prisma.user.findUnique({ where: { id: creatorId }, select: { id: true } })
    if (!user) creatorId = undefined
  }
  if (!creatorId) creatorId = document.createdById
  if (!creatorId) {
    throw createError({ statusCode: 400, message: 'creator userId is required' })
  }

  const version = await prisma.documentVersion.create({
    data: {
      documentId: id,
      title: (title ?? document.title).toString(),
      content: (content ?? document.content).toString(),
      label: label?.toString() ?? null,
      notes: notes?.toString() ?? null,
      type: (type?.toString()?.toUpperCase() === 'MAJOR' ? 'MAJOR' : 'MINOR'),
      createdById: creatorId,
    },
    include: { createdBy: true },
  })

  return {
    id: version.id,
    documentId: version.documentId,
    title: version.title,
    content: version.content,
    label: version.label,
    notes: version.notes,
    type: version.type.toLowerCase(),
    createdAt: version.createdAt.toISOString(),
    createdBy: version.createdBy ? {
      id: version.createdBy.id,
      name: version.createdBy.name ?? version.createdBy.email.split('@')[0],
      avatar: version.createdBy.avatar,
    } : null,
  }
})
