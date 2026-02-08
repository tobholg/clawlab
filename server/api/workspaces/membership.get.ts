import { requireWorkspaceMember } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  const auth = await requireWorkspaceMember(event, workspaceId)

  return {
    workspaceId,
    role: auth.workspaceRole,
    orgRole: auth.orgRole,
    isOrgAdmin: auth.isOrgAdmin,
    isWorkspaceAdmin: auth.isWorkspaceAdmin,
  }
})
