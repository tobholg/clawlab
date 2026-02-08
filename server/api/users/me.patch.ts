import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const sessionUser = await requireUser(event)
  const body = await readBody(event)

  const name = typeof body.name === 'string' ? body.name.trim() : undefined
  const position = typeof body.position === 'string' ? body.position.trim() : undefined

  if (name !== undefined && (name.length < 1 || name.length > 100)) {
    throw createError({ statusCode: 400, message: 'Name must be 1-100 characters' })
  }

  if (position !== undefined && position.length > 100) {
    throw createError({ statusCode: 400, message: 'Position must be at most 100 characters' })
  }

  const data: Record<string, string | null> = {}
  if (name !== undefined) data.name = name
  if (position !== undefined) data.position = position || null

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, message: 'Nothing to update' })
  }

  const updated = await prisma.user.update({
    where: { id: sessionUser.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      position: true,
    },
  })

  return updated
})
