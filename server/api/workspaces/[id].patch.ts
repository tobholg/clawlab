import { prisma } from '../../utils/prisma'
import { requireWorkspaceMember, requireMinRole } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const workspaceId = getRouterParam(event, 'id')

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'Workspace ID is required' })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)
  requireMinRole(auth, 'ADMIN')

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
