// GET /api/focus/team - Get team focus presence for a workspace
import { prisma } from '../../utils/prisma'
import { requireWorkspaceMember } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const workspaceId = query.workspaceId as string

  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'workspaceId is required' })
  }

  await requireWorkspaceMember(event, workspaceId)

  // Get all active workspace members with their current focus state
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: 'ACTIVE' },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          currentProjectFocusId: true,
          currentProjectFocusStart: true,
          currentTaskFocusId: true,
          currentLaneFocus: true,
          currentActivityStart: true,
          currentProjectFocus: {
            select: { id: true, title: true }
          },
          currentTaskFocus: {
            select: { id: true, title: true }
          }
        }
      }
    }
  })

  // Format the response
  const teamFocus = members.map(member => {
    const user = member.user
    const hasAnyFocus = user.currentProjectFocusId || user.currentTaskFocusId || user.currentLaneFocus

    return {
      userId: user.id,
      name: user.name || user.email?.split('@')[0] || 'Unknown',
      avatar: user.avatar,
      // Focus state
      project: user.currentProjectFocus ? {
        id: user.currentProjectFocus.id,
        title: user.currentProjectFocus.title,
        since: user.currentProjectFocusStart,
      } : null,
      task: user.currentTaskFocus ? {
        id: user.currentTaskFocus.id,
        title: user.currentTaskFocus.title,
        since: user.currentActivityStart,
      } : null,
      lane: user.currentLaneFocus ? {
        type: user.currentLaneFocus,
        since: user.currentActivityStart,
      } : null,
      // Computed
      isFocused: hasAnyFocus,
      activityLabel: getActivityLabel(user),
    }
  })

  return {
    workspaceId,
    members: teamFocus,
  }
})

function getActivityLabel(user: any): string | null {
  if (user.currentTaskFocus) {
    return user.currentTaskFocus.title
  }
  if (user.currentLaneFocus) {
    const laneLabels: Record<string, string> = {
      GENERAL: 'General work',
      MEETING: 'In a meeting',
      ADMIN: 'Admin tasks',
      LEARNING: 'Learning',
      BREAK: 'Taking a break',
    }
    return laneLabels[user.currentLaneFocus] || user.currentLaneFocus
  }
  return null
}
