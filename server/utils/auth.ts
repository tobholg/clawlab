import { SignJWT, jwtVerify } from 'jose'
import {
  H3Event,
  createError,
  deleteCookie,
  getCookie,
  getRequestURL,
  setCookie
} from 'h3'
import { useRuntimeConfig } from '#imports'
import { prisma } from './prisma'

export type SessionUser = {
  id: string
  email: string
  name: string | null
  role: string
}

type AuthTokenPayload = {
  sub: string
  email: string
}

const COOKIE_NAME = 'relai_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

const getJwtSecret = () => {
  const config = useRuntimeConfig()
  const secret = config.jwtSecret

  if (!secret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'JWT_SECRET is not configured'
    })
  }

  return new TextEncoder().encode(secret)
}

export const signAuthToken = async (payload: AuthTokenPayload) => {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(getJwtSecret())
}

export const verifyAuthToken = async (token: string) => {
  const { payload } = await jwtVerify<AuthTokenPayload>(token, getJwtSecret())
  return payload
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/'
}

export const setAuthCookie = (event: H3Event, token: string) => {
  setCookie(event, COOKIE_NAME, token, {
    ...cookieOptions,
    maxAge: COOKIE_MAX_AGE
  })
}

export const clearAuthCookie = (event: H3Event) => {
  deleteCookie(event, COOKIE_NAME, cookieOptions)
}

export const buildAppBaseUrl = (event: H3Event) => {
  const config = useRuntimeConfig()
  if (config.public?.appUrl) {
    return config.public.appUrl.replace(/\/$/, '')
  }

  const url = getRequestURL(event)
  return `${url.protocol}//${url.host}`
}

export const buildMagicLinkUrl = (event: H3Event, token: string, redirect?: string) => {
  const base = buildAppBaseUrl(event)
  let url = `${base}/auth/confirm?token=${encodeURIComponent(token)}`
  if (redirect) {
    url += `&redirect=${encodeURIComponent(redirect)}`
  }
  return url
}

export const consumeMagicLink = async (token: string) => {
  const record = await prisma.magicLinkToken.findUnique({
    where: { token },
    include: { user: true }
  })

  if (!record || record.usedAt) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid magic link' })
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw createError({ statusCode: 400, statusMessage: 'Magic link expired' })
  }

  await prisma.magicLinkToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  })

  return record.user
}

export const getSessionUser = async (event: H3Event): Promise<SessionUser | null> => {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return null

  try {
    const payload = await verifyAuthToken(token)
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true }
    })
    if (!user) return null
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: 'MEMBER' // Default role since User model doesn't have role field
    }
  } catch (error) {
    clearAuthCookie(event)
    return null
  }
}

export const createSession = async (event: H3Event, user: { id: string; email: string }) => {
  const token = await signAuthToken({ sub: user.id, email: user.email })
  setAuthCookie(event, token)
  return token
}

export const requireUser = async (event: H3Event): Promise<SessionUser> => {
  const user = await getSessionUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return user
}

export const requireBuilder = async (event: H3Event): Promise<SessionUser> => {
  const user = await requireUser(event)
  if (user.role !== 'BUILDER') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Builder access required' })
  }
  return user
}
