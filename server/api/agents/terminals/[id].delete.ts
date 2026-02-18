import { requireUser, requireWorkspaceMember } from '../../../utils/auth'
import { destroyPtySession } from '../../../utils/ptyManager'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const terminalId = getRouterParam(event, 'id')?.trim()

  if (!terminalId) {
    throw createError({ statusCode: 400, message: 'Terminal ID is required' })
  }

  const session = await prisma.agentSession.findUnique({
    where: { terminalId },
    select: {
      id: true,
      projectId: true,
      itemId: true,
      item: {
        select: {
          workspaceId: true,
          projectId: true,
        },
      },
    },
  })

  if (!session) {
    throw createError({ statusCode: 404, message: 'Terminal session not found' })
  }

  const resolvedProjectId = session.projectId ?? session.item?.projectId ?? session.itemId ?? null
  const project = resolvedProjectId
    ? await prisma.item.findUnique({
        where: { id: resolvedProjectId },
        select: {
          workspaceId: true,
        },
      })
    : null

  const workspaceId = session.item?.workspaceId ?? project?.workspaceId ?? null
  if (!workspaceId) {
    throw createError({ statusCode: 400, message: 'Unable to resolve workspace for terminal session' })
  }

  await requireWorkspaceMember(event, workspaceId)

  destroyPtySession(terminalId)

  await prisma.agentSession.update({
    where: { id: session.id },
    data: {
      status: 'TERMINATED',
      completedAt: new Date(),
    },
  })

  return {
    success: true,
  }
})
