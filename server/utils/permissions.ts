import { createError } from 'h3'
import { prisma } from './prisma'
import type { AuthenticatedMember } from './auth'

export type ItemPermission =
  | 'view'
  | 'edit'
  | 'change_status'
  | 'assign'
  | 'add_stakeholder'
  | 'delete'
  | 'add_child'
  | 'post_channel'

export type ItemRelationship = 'owner' | 'assignee' | 'stakeholder' | 'none'

// Permission table: which relationships grant which permissions
const RELATIONSHIP_PERMISSIONS: Record<ItemRelationship, Set<ItemPermission>> = {
  owner: new Set(['view', 'edit', 'change_status', 'assign', 'add_stakeholder', 'delete', 'add_child', 'post_channel']),
  assignee: new Set(['view', 'edit', 'change_status', 'add_child', 'post_channel']),
  stakeholder: new Set(['view', 'post_channel']),
  none: new Set(['view']),
}

/**
 * Resolve a user's relationship to an item.
 * Checks in priority order: direct owner > assignee > ancestor owner > stakeholder > none.
 * Caps ancestor walk at 10 levels.
 */
export async function resolveItemRelationship(userId: string, itemId: string): Promise<ItemRelationship> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { ownerId: true, projectId: true, parentId: true },
  })
  if (!item) return 'none'

  // Direct owner
  if (item.ownerId === userId) return 'owner'

  // Direct assignee
  const assignment = await prisma.itemAssignment.findUnique({
    where: { itemId_userId: { itemId, userId } },
  })
  if (assignment) return 'assignee'

  // Ancestor owner check: if user owns the root project, they own the tree
  if (item.projectId) {
    const project = await prisma.item.findUnique({
      where: { id: item.projectId },
      select: { ownerId: true },
    })
    if (project?.ownerId === userId) return 'owner'
  }

  // Walk up the parent chain (cap at 10 levels)
  let currentParentId = item.parentId
  let depth = 0
  while (currentParentId && depth < 10) {
    const parent = await prisma.item.findUnique({
      where: { id: currentParentId },
      select: { ownerId: true, parentId: true },
    })
    if (!parent) break
    if (parent.ownerId === userId) return 'owner'
    currentParentId = parent.parentId
    depth++
  }

  // Stakeholder
  const stakeholder = await prisma.itemStakeholder.findUnique({
    where: { itemId_userId: { itemId, userId } },
  })
  if (stakeholder) return 'stakeholder'

  return 'none'
}

/**
 * Check if the authenticated member has the required permission on an item.
 * Workspace ADMIN/OWNER always passes (bypasses item-level checks).
 * All members can 'view' any item in their workspace.
 */
export async function requireItemPermission(
  auth: AuthenticatedMember,
  itemId: string,
  permission: ItemPermission,
): Promise<void> {
  // Workspace admins/owners bypass item-level permission checks
  if (auth.isWorkspaceAdmin) return

  // All workspace members can view
  if (permission === 'view') return

  const relationship = await resolveItemRelationship(auth.user.id, itemId)
  const allowed = RELATIONSHIP_PERMISSIONS[relationship]

  if (!allowed.has(permission)) {
    throw createError({
      statusCode: 403,
      statusMessage: `You do not have '${permission}' permission on this item`,
    })
  }
}
