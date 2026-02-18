import { requireUser, requireWorkspaceMember } from '../../../utils/auth'
import { destroyPtySession } from '../../../utils/ptyManager'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  await requireUser(event)
  const terminalId = getRouterParam(event, 'id')?.trim()

  if (!terminalId) {
    throw createError({ statusCode: 400, message: 'Terminal ID is required' })
  }

  // Always try to kill the PTY process regardless of DB state
  destroyPtySession(terminalId)

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
    // PTY already killed above — just return success
    return { success: true }
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
  if (workspaceId) {
    await requireWorkspaceMember(event, workspaceId)
  }

  await prisma.agentSession.update({
    where: { id: session.id },
    data: {
      status: 'TERMINATED',
      completedAt: new Date(),
    },
  })

  return { success: true }
})
