import { prisma } from '../../utils/prisma'
import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const workspaceId = getRouterParam(event, 'id')

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  }

  // Require OWNER role
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } }
  })

  if (!membership || membership.status !== 'ACTIVE' || membership.role !== 'OWNER') {
    throw createError({ statusCode: 403, message: 'Owner access required' })
  }

  const body = await readBody(event)
  const { name, description } = body

  const data: Record<string, any> = {}
  if (name !== undefined) data.name = name
  if (description !== undefined) data.description = description

  if (Object.keys(data).length === 0) {
    throw createError({ statusCode: 400, message: 'No fields to update' })
  }

  const workspace = await prisma.workspace.update({
    where: { id: workspaceId },
    data,
  })

  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    description: workspace.description,
    updatedAt: workspace.updatedAt.toISOString(),
  }
})
