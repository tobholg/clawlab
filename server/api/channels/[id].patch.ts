import { prisma } from '../../utils/prisma'
import { requireWorkspaceMemberForChannel } from '../../utils/auth'
import { slugify } from '../../utils/channelUtils'

const MAX_NAME_LENGTH = 80
const MAX_DESCRIPTION_LENGTH = 500

interface UpdateChannelBody {
  name?: string
  displayName?: string
  description?: string
  visibility?: 'PUBLIC' | 'PRIVATE' | 'EXTERNAL'
  archived?: boolean
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody<UpdateChannelBody>(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Channel ID is required' })
  }

  await requireWorkspaceMemberForChannel(event, id)

  const channel = await prisma.channel.findUnique({
    where: { id },
  })

  if (!channel) {
    throw createError({ statusCode: 404, message: 'Channel not found' })
  }

  // Build update data
  const updateData: Record<string, unknown> = {}

  if (body.displayName !== undefined) {
    if (body.displayName && body.displayName.length > MAX_NAME_LENGTH) {
      throw createError({ statusCode: 400, message: `Channel name must be ${MAX_NAME_LENGTH} characters or fewer` })
    }
    updateData.displayName = body.displayName || null
  }

  if (body.description !== undefined) {
    if (body.description && body.description.length > MAX_DESCRIPTION_LENGTH) {
      throw createError({ statusCode: 400, message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer` })
    }
    updateData.description = body.description || null
  }

  if (body.visibility !== undefined) {
    updateData.visibility = body.visibility
  }

  if (body.archived !== undefined) {
    updateData.archived = body.archived
  }

  // Handle name change - ensure uniqueness
  if (body.name !== undefined && body.name !== channel.name) {
    let name = slugify(body.name)
    if (!name) {
      throw createError({ statusCode: 400, message: 'Invalid channel name' })
    }

    // Check uniqueness
    const existing = await prisma.channel.findFirst({
      where: {
        workspaceId: channel.workspaceId,
        name,
        id: { not: id },
      },
    })
    if (existing) {
      throw createError({ statusCode: 400, message: 'Channel name already exists' })
    }
    updateData.name = name
  }

  const updated = await prisma.channel.update({
    where: { id },
    data: updateData,
  })

  return {
    id: updated.id,
    workspaceId: updated.workspaceId,
    parentId: updated.parentId,
    projectId: updated.projectId,
    name: updated.name,
    displayName: updated.displayName ?? updated.name,
    description: updated.description,
    type: updated.type.toLowerCase(),
    visibility: updated.visibility.toLowerCase(),
    inheritMembers: updated.inheritMembers,
    archived: updated.archived,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  }
})
