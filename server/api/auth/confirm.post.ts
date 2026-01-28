import { createError, defineEventHandler, readBody } from 'h3'
import { consumeMagicLink, createSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string }>(event)
  const token = body.token

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token is required' })
  }

  // Verify and consume the magic link
  const user = await consumeMagicLink(token)

  // Create session
  await createSession(event, user)

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  }
})
