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

export type AuthenticatedMember = {
  user: SessionUser
  workspaceId: string
  workspaceRole: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
  orgRole: 'OWNER' | 'ADMIN' | 'MEMBER'
  isOrgAdmin: boolean      // orgRole in ['OWNER','ADMIN']
  isWorkspaceAdmin: boolean // workspaceRole in ['OWNER','ADMIN'] || isOrgAdmin
}

type AuthTokenPayload = {
  sub: string
  email: string
}

const COOKIE_NAME = 'ctx_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

const WORKSPACE_ROLE_HIERARCHY: Record<string, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
}

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

export const consumeMagicLink = async (token: string, code: string) => {
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

  if (record.code !== code) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid verification code' })
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

/**
 * Require that the authenticated user is an ACTIVE member of the given workspace.
 * Returns AuthenticatedMember with role info. Org OWNER/ADMIN get implicit workspace ADMIN access.
 */
export const requireWorkspaceMember = async (event: H3Event, workspaceId: string): Promise<AuthenticatedMember> => {
  const user = await requireUser(event)

  // Fetch workspace membership and workspace's organizationId in parallel
  const [membership, workspace] = await Promise.all([
    prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: user.id },
      },
      select: { status: true, role: true },
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true },
    }),
  ])

  if (!workspace) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace not found' })
  }

  // Fetch org membership
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId: workspace.organizationId, userId: user.id },
    },
    select: { role: true, status: true },
  })

  if (!orgMembership || orgMembership.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, statusMessage: 'You are not an active member of this organization' })
  }

  const orgRole = orgMembership.role as 'OWNER' | 'ADMIN' | 'MEMBER'
  const isOrgAdmin = orgRole === 'OWNER' || orgRole === 'ADMIN'

  // If user has explicit workspace membership
  if (membership && membership.status === 'ACTIVE') {
    const workspaceRole = membership.role as 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
    return {
      user,
      workspaceId,
      workspaceRole,
      orgRole,
      isOrgAdmin,
      isWorkspaceAdmin: workspaceRole === 'OWNER' || workspaceRole === 'ADMIN' || isOrgAdmin,
    }
  }

  // Org OWNER/ADMIN gets implicit workspace ADMIN access without explicit membership
  if (isOrgAdmin) {
    return {
      user,
      workspaceId,
      workspaceRole: 'ADMIN', // Implicit admin from org role
      orgRole,
      isOrgAdmin: true,
      isWorkspaceAdmin: true,
    }
  }

  throw createError({ statusCode: 403, statusMessage: 'You are not an active member of this workspace' })
}

/**
 * Look up the workspace for a given item and verify the user is an ACTIVE member.
 * Returns AuthenticatedMember with role info.
 */
export const requireWorkspaceMemberForItem = async (event: H3Event, itemId: string): Promise<AuthenticatedMember> => {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { workspaceId: true },
  })
  if (!item) {
    throw createError({ statusCode: 404, statusMessage: 'Item not found' })
  }
  return requireWorkspaceMember(event, item.workspaceId)
}

/**
 * Look up the workspace for a given channel and verify the user is an ACTIVE member.
 * Returns AuthenticatedMember with role info.
 */
export const requireWorkspaceMemberForChannel = async (event: H3Event, channelId: string): Promise<AuthenticatedMember> => {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { workspaceId: true },
  })
  if (!channel) {
    throw createError({ statusCode: 404, statusMessage: 'Channel not found' })
  }
  return requireWorkspaceMember(event, channel.workspaceId)
}

export type AuthenticatedOrgAdmin = {
  user: SessionUser
  organizationId: string
  orgRole: 'OWNER' | 'ADMIN'
}

/**
 * Require that the authenticated user is an ACTIVE OWNER or ADMIN of the given organization.
 */
export const requireOrgAdmin = async (event: H3Event, organizationId: string): Promise<AuthenticatedOrgAdmin> => {
  const user = await requireUser(event)

  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: user.id },
    },
    select: { role: true, status: true },
  })

  if (!orgMembership || orgMembership.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, statusMessage: 'You are not an active member of this organization' })
  }

  if (orgMembership.role !== 'OWNER' && orgMembership.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Organization admin access required' })
  }

  return {
    user,
    organizationId,
    orgRole: orgMembership.role as 'OWNER' | 'ADMIN',
  }
}

/**
 * Require that the authenticated member has at least the specified workspace role.
 * Org admins always bypass this check.
 */
export const requireMinRole = (auth: AuthenticatedMember, minRole: 'OWNER' | 'ADMIN' | 'MEMBER'): void => {
  if (auth.isOrgAdmin) return // Org admins bypass workspace role checks

  const userLevel = WORKSPACE_ROLE_HIERARCHY[auth.workspaceRole] ?? 0
  const requiredLevel = WORKSPACE_ROLE_HIERARCHY[minRole] ?? 0

  if (userLevel < requiredLevel) {
    throw createError({
      statusCode: 403,
      statusMessage: `Requires ${minRole} role or higher`,
    })
  }
}
