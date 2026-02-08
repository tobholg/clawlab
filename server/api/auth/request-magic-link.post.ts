import { createError, defineEventHandler, readBody } from 'h3'
import { prisma } from '../../utils/prisma'
import { buildMagicLinkUrl } from '../../utils/auth'
import { generateVerificationCode, sendMagicLinkEmail } from '../../utils/email'

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    email?: string
    inviteToken?: string
    displayName?: string
    position?: string
  }>(event)
  const email = body.email?.toLowerCase().trim()

  if (!email) {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }

  // Upsert user - create if doesn't exist
  const user = await prisma.user.upsert({
    where: { email },
    update: body.displayName ? { name: body.displayName } : {},
    create: {
      email,
      name: body.displayName || null
    }
  })

  // Generate magic link token + verification code
  const token = crypto.randomUUID()
  const code = generateVerificationCode()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.magicLinkToken.create({
    data: {
      token,
      code,
      expiresAt,
      userId: user.id
    }
  })

  // Build redirect URL if invite token provided
  let redirect: string | undefined
  if (body.inviteToken) {
    redirect = `/invite/${body.inviteToken}`
  }

  const link = buildMagicLinkUrl(event, token, redirect)

  // Send email via Postmark
  try {
    await sendMagicLinkEmail(email, link, code)
  } catch (e) {
    console.error('[auth] Failed to send magic link email:', e)
    // In development, still log the link for testing
    if (process.env.NODE_ENV === 'development') {
      console.info(`[auth] Magic link for ${email}: ${link}`)
      console.info(`[auth] Verification code: ${code}`)
    }
  }

  return {
    ok: true,
    message: 'If this email exists, a login link has been sent.',
    // Include link + code in development for testing
    ...(process.env.NODE_ENV === 'development' && { link, code })
  }
})
