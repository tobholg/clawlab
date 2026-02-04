import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string
  
  // If workspaceId provided, get workspace members
  // Otherwise get all users (for now)
  const users = workspaceId 
    ? await prisma.user.findMany({
        where: {
          workspaceMembers: {
            some: { workspaceId }
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
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
    hasFocus: !!(u.currentTaskFocusId || u.currentLaneFocus || u.currentProjectFocusId),
  }))
})
