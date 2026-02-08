import { prisma } from '../../utils/prisma'
import { requireWorkspaceMember, requireMinRole } from '../../utils/auth'
import { slugify } from '../../utils/channelUtils'

const MAX_NAME_LENGTH = 80
const MAX_DESCRIPTION_LENGTH = 500

interface CreateChannelBody {
  workspaceId: string
  name?: string
  displayName?: string
  description?: string
  type?: 'WORKSPACE' | 'PROJECT' | 'EXTERNAL' | 'CUSTOM'
  visibility?: 'PUBLIC' | 'PRIVATE' | 'EXTERNAL'
  parentId?: string
  projectId?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<CreateChannelBody>(event)

  const { workspaceId, displayName, description, type, visibility, parentId, projectId } = body

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)
  requireMinRole(auth, 'MEMBER') // VIEWERs cannot create channels
  const user = auth.user

  // Generate name from displayName if not provided
  let name = body.name
  if (!name && displayName) {
    name = slugify(displayName)
  }
  if (!name) {
    throw createError({ statusCode: 400, message: 'name or displayName is required' })
  }

  if (name.length > MAX_NAME_LENGTH || (displayName && displayName.length > MAX_NAME_LENGTH)) {
    throw createError({ statusCode: 400, message: `Channel name must be ${MAX_NAME_LENGTH} characters or fewer` })
  }

  if (description && description.length > MAX_DESCRIPTION_LENGTH) {
    throw createError({ statusCode: 400, message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` })
  }

  // FREE tier: only WORKSPACE and PROJECT channels allowed (no CUSTOM)
  const effectiveType = type || 'CUSTOM'
  if (effectiveType === 'CUSTOM') {
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { organization: { select: { planTier: true } } },
    })
    if (workspace.organization.planTier === 'FREE') {
      throw createError({
        statusCode: 403,
        message: 'Custom channels are not available on the Free plan. Upgrade to Pro to create custom channels.',
      })
    }
  }

  // Ensure unique name within workspace
  let baseName = name
  let suffix = 1
  while (true) {
    const existing = await prisma.channel.findUnique({
      where: {
        workspaceId_name: { workspaceId, name },
      },
    })
    if (!existing) break
    name = `${baseName}-${suffix}`
    suffix++
  }

  // Verify projectId exists and belongs to workspace if provided
  if (projectId) {
    const project = await prisma.item.findFirst({
      where: { id: projectId, workspaceId, parentId: null },
    })
    if (!project) {
      throw createError({ statusCode: 400, message: 'Invalid projectId' })
    }
    // Check if project already has a channel
    const existingChannel = await prisma.channel.findUnique({
      where: { projectId },
    })
    if (existingChannel) {
      throw createError({ statusCode: 400, message: 'Project already has a channel' })
    }
  }

  const channel = await prisma.channel.create({
    data: {
      workspaceId,
      name,
      displayName: displayName || null,
      description: description || null,
      type: effectiveType,
      visibility: visibility || 'PUBLIC',
      parentId: parentId || null,
      projectId: projectId || null,
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
    include: {
      members: {
        include: { user: true },
      },
    },
  })

  return {
    id: channel.id,
    workspaceId: channel.workspaceId,
    parentId: channel.parentId,
    projectId: channel.projectId,
    name: channel.name,
    displayName: channel.displayName ?? channel.name,
    description: channel.description,
    type: channel.type.toLowerCase(),
    visibility: channel.visibility.toLowerCase(),
    inheritMembers: channel.inheritMembers,
    archived: channel.archived,
    createdAt: channel.createdAt.toISOString(),
    updatedAt: channel.updatedAt.toISOString(),
    members: channel.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role.toLowerCase(),
      isExternal: m.isExternal,
      user: {
        id: m.user.id,
        name: m.user.name,
        avatar: m.user.avatar,
      },
    })),
  }
})
