import { prisma } from '../../utils/prisma'
import { requireUser, requireWorkspaceMember } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string

  // Require workspace membership when filtering by workspace
  if (workspaceId) {
    await requireWorkspaceMember(event, workspaceId)
  }

  const users = workspaceId
    ? await prisma.user.findMany({
        where: {
          workspaceMembers: {
            some: { workspaceId, status: 'ACTIVE' }
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          isAgent: true,
          currentProjectFocusId: true,
          currentTaskFocusId: true,
          currentLaneFocus: true,
        },
        orderBy: { name: 'asc' }
      })
    : await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          isAgent: true,
          currentProjectFocusId: true,
          currentTaskFocusId: true,
          currentLaneFocus: true,
        },
        orderBy: { name: 'asc' }
      })
  
  return users.map(u => ({
    id: u.id,
    name: u.name ?? u.email.split('@')[0],
    email: u.email,
    avatar: u.avatar,
    isAgent: u.isAgent,
    hasFocus: !!(u.currentTaskFocusId || u.currentLaneFocus || u.currentProjectFocusId),
  }))
})
