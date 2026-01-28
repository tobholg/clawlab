import { createError, defineEventHandler, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { buildMagicLinkUrl } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string }>(event)
  const email = body.email?.toLowerCase().trim()

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }

  // Upsert user - create if doesn't exist
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email }
  })

  // Generate magic link token
  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes

  await prisma.magicLinkToken.create({
    data: {
      token,
      expiresAt,
      userId: user.id
    }
  })

  const link = buildMagicLinkUrl(event, token)

  // TODO: Send email with magic link
  // For now, log it in development
  console.info(`[auth] Magic link for ${email}: ${link}`)

  // In production, you'd use a service like Resend, Sendgrid, etc.
  // await sendMagicLinkEmail(email, link)

  return {
    ok: true,
    message: 'If this email exists, a login link has been sent.',
    // Only include link in development for testing
    ...(process.env.NODE_ENV === 'development' && { link })
  }
})
