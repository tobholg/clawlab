import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'
import { checkCanCreateWorkspace } from '../../utils/planLimits'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)

  const { name, description, organizationId } = body

  if (!name || !organizationId) {
    throw createError({ statusCode: 400, message: 'name and organizationId are required' })
  }

  if (typeof name !== 'string' || name.trim().length === 0 || name.length > 100) {
    throw createError({ statusCode: 400, message: 'name must be 1-100 characters' })
  }

  // Verify user is org OWNER or ADMIN
  const orgMembership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId: user.id },
    },
    select: { role: true, status: true },
  })

  if (!orgMembership || orgMembership.status !== 'ACTIVE') {
    throw createError({ statusCode: 403, statusMessage: 'Not an active org member' })
  }

  if (orgMembership.role !== 'OWNER' && orgMembership.role !== 'ADMIN') {
    throw createError({ statusCode: 403, statusMessage: 'Only org owners and admins can create workspaces' })
  }

  // Check plan limit
  const check = await checkCanCreateWorkspace(organizationId)
  if (!check.allowed) {
    throw createError({
      statusCode: 403,
      message: `Workspace limit reached (${check.current}/${check.limit}). Adjust your configured limits to create more workspaces.`,
    })
  }

  // Generate slug from name
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  let slug = baseSlug
  let suffix = 1
  while (true) {
    const existing = await prisma.workspace.findUnique({ where: { slug } })
    if (!existing) break
    slug = `${baseSlug}-${suffix}`
    suffix++
  }

  const workspace = await prisma.workspace.create({
    data: {
      organizationId,
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
    include: {
      _count: { select: { items: true, members: true } },
    },
  })

  // Create default channels
  try {
    await prisma.channel.createMany({
      data: [
        {
          workspaceId: workspace.id,
          name: 'general',
          displayName: 'General',
          type: 'WORKSPACE',
          visibility: 'PUBLIC',
        },
        {
          workspaceId: workspace.id,
          name: 'off-topic',
          displayName: 'Off Topic',
          type: 'WORKSPACE',
          visibility: 'PUBLIC',
        },
      ],
    })
    // Add creator as OWNER of both channels
    const channels = await prisma.channel.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true },
    })
    if (channels.length > 0) {
      await prisma.channelMember.createMany({
        data: channels.map(ch => ({ channelId: ch.id, userId: user.id, role: 'OWNER' as const })),
      })
    }
  } catch {
    // Non-critical
  }

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    organizationId: workspace.organizationId,
    itemCount: workspace._count.items,
    memberCount: workspace._count.members,
    createdAt: workspace.createdAt.toISOString(),
  }
})
