import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Document ID is required' })
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: { id: true },
  })

  if (!document) {
    throw createError({ statusCode: 404, message: 'Document not found' })
  }

  // Delete all versions first (due to foreign key constraint)
  await prisma.documentVersion.deleteMany({
    where: { documentId: id },
  })

  // Delete the document
  await prisma.document.delete({
    where: { id },
  })

  return { success: true }
})
