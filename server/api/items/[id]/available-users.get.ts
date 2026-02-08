import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  await requireWorkspaceMemberForItem(event, id)
  
  // Get the item to find its workspace and parent chain
  const item = await prisma.item.findUnique({
    where: { id },
    select: { 
      workspaceId: true, 
      parentId: true,
      parent: {
        select: {
          assignees: {
            include: { user: true }
          }
        }
      }
    }
  })
  
  if (!item) {
    throw createError({ statusCode: 404, message: 'Item not found' })
  }
  
  // Strategy: 
  // 1. If item has parent, return parent's assignees (team members of parent project)
  // 2. Otherwise return workspace members
  // 3. Fallback to all users
  
  let users: any[] = []
  
  if (item.parent?.assignees?.length) {
    // Return parent's assignees (project team)
    users = item.parent.assignees.map(a => a.user)
  } else {
    // Return workspace members or all users
    const workspaceMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId: item.workspaceId, status: 'ACTIVE' },
      include: { user: true }
    })
    
    if (workspaceMembers.length > 0) {
      users = workspaceMembers.map(m => m.user)
    } else {
      // Fallback: all users
      users = await prisma.user.findMany({
        take: 50,
        orderBy: { name: 'asc' }
      })
    }
  }
  
  return users.map(u => ({
    id: u.id,
    name: u.name ?? u.email?.split('@')[0] ?? 'User',
    email: u.email,
    avatar: u.avatar,
  }))
})
