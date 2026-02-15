import { prisma } from '../../utils/prisma'
import { verifyPassword } from '../../utils/password'
import { createSession } from '../../utils/auth'

interface LoginRequest {
  email?: string
  password: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginRequest>(event)

  if (!body.password) {
    throw createError({ statusCode: 400, message: 'Password is required' })
  }

  let user

  if (body.email) {
    // Multi-user: look up by email
    user = await prisma.user.findUnique({
      where: { email: body.email.trim().toLowerCase() },
      select: { id: true, email: true, passwordHash: true },
    })
  } else {
    // Single-user mode: find the only user
    const users = await prisma.user.findMany({
      take: 2,
      select: { id: true, email: true, passwordHash: true },
    })
    if (users.length === 1) {
      user = users[0]
    } else {
      throw createError({ statusCode: 400, message: 'Email is required when multiple users exist' })
    }
  }

  if (!user || !user.passwordHash) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  const valid = await verifyPassword(body.password, user.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  await createSession(event, { id: user.id, email: user.email })

  return { ok: true }
})
