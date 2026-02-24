import { requireUser } from '../../utils/auth'
import { listPtySessions } from '../../utils/ptyManager'
import { prisma } from '../../utils/prisma'

async function getAccessibleWorkspaceIds(userId: string) {
  const [workspaceMemberships, orgMemberships] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        workspaceId: true,
      },
    }),
    prisma.organizationMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        organizationId: true,
        role: true,
      },
    }),
  ])

  const workspaceIds = new Set(workspaceMemberships.map((membership) => membership.workspaceId))

  const adminOrgIds = orgMemberships
    .filter((membership) => membership.role === 'OWNER' || membership.role === 'ADMIN')
    .map((membership) => membership.organizationId)

  if (adminOrgIds.length > 0) {
    const orgWorkspaces = await prisma.workspace.findMany({
      where: {
        organizationId: { in: adminOrgIds },
      },
      select: {
        id: true,
      },
    })

    for (const workspace of orgWorkspaces) {
      workspaceIds.add(workspace.id)
    }
  }

  return workspaceIds
}

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const activePtys = listPtySessions()

  if (!activePtys.length) {
    return []
  }

  const accessibleWorkspaceIds = await getAccessibleWorkspaceIds(user.id)
  if (!accessibleWorkspaceIds.size) {
    return []
  }

  const agentSessionIds = [...new Set(activePtys.map((session) => session.agentSessionId))]
  const sessions = await prisma.agentSession.findMany({
    where: {
      id: { in: agentSessionIds },
    },
    select: {
      id: true,
      terminalId: true,
      projectId: true,
      itemId: true,
      status: true,
      createdAt: true,
      checkedOutAt: true,
      updatedAt: true,
      item: {
        select: {
          id: true,
          title: true,
          parentId: true,
          workspaceId: true,
          projectId: true,
        },
      },
      agent: {
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          agentProvider: true,
        },
      },
    },
  })

  const projectIds = [...new Set(sessions
    .map((session) => {
      if (session.projectId) return session.projectId
      if (session.item?.projectId) return session.item.projectId
      if (session.item && !session.item.parentId) return session.item.id
      return null
    })
    .filter((id): id is string => !!id))]

  const projects = projectIds.length
    ? await prisma.item.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          title: true,
          workspaceId: true,
        },
      })
    : []

  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const projectById = new Map(projects.map((project) => [project.id, project]))

  return activePtys
    .map((ptySession) => {
      const session = sessionById.get(ptySession.agentSessionId)
      if (!session) return null

      const resolvedProjectId = session.projectId
        ?? session.item?.projectId
        ?? (session.item && !session.item.parentId ? session.item.id : null)
      const project = resolvedProjectId ? projectById.get(resolvedProjectId) : null
      const workspaceId = session.item?.workspaceId ?? project?.workspaceId ?? null

      if (!workspaceId || !accessibleWorkspaceIds.has(workspaceId)) {
        return null
      }

      return {
        terminalId: ptySession.terminalId,
        agentSessionId: session.id,
        workspaceId,
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        checkedOutAt: session.checkedOutAt?.toISOString() ?? null,
        updatedAt: session.updatedAt.toISOString(),
        agent: {
          id: session.agent.id,
          name: session.agent.name ?? session.agent.email.split('@')[0],
          email: session.agent.email,
          avatar: session.agent.avatar,
          provider: session.agent.agentProvider,
        },
        task: session.item
          ? {
              id: session.item.id,
              title: session.item.title,
            }
          : null,
        project: project
          ? {
              id: project.id,
              title: project.title,
            }
          : null,
      }
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
})
