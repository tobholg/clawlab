import { createError, defineEventHandler, readBody } from 'h3'
import { consumeMagicLink, createSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: string; code?: string }>(event)
  const token = body.token
  const code = body.code?.toUpperCase().trim()

  if (!token) {
    throw createError({ statusCode: 400, statusMessage: 'Token is required' })
  }

  if (!code || code.length !== 4) {
    throw createError({ statusCode: 400, statusMessage: 'A 4-character verification code is required' })
  }

  // Verify and consume the magic link (with code check)
  const user = await consumeMagicLink(token, code)

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
