import { Prisma } from '@prisma/client'
import { prisma } from '../../utils/prisma'
import { getCommitInfo, resolveRepoPath } from '../../utils/gitOps'
import { requireTokenUser, requireAssignedTask } from '../../utils/agentApi'

export default defineEventHandler(async (event) => {
  const agent = await requireTokenUser(event)
  const body = await readBody(event)

  const sha = typeof body.sha === 'string' ? body.sha.trim() : ''
  const taskIdOverride = typeof body.taskId === 'string' ? body.taskId.trim() : ''

  if (!sha) {
    throw createError({ statusCode: 400, message: 'sha is required' })
  }

  let sessionId: string | null = null
  let itemId: string

  if (taskIdOverride) {
    const task = await requireAssignedTask(agent.id, taskIdOverride)
    itemId = task.id

    const activeSession = await prisma.agentSession.findFirst({
      where: {
        agentId: agent.id,
        itemId,
        status: 'ACTIVE',
      },
      select: { id: true },
      orderBy: [{ checkedOutAt: 'desc' }, { updatedAt: 'desc' }],
    })
    sessionId = activeSession?.id ?? null
  } else {
    const activeSession = await prisma.agentSession.findFirst({
      where: {
        agentId: agent.id,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        itemId: true,
      },
      orderBy: [{ checkedOutAt: 'desc' }, { updatedAt: 'desc' }],
    })

    if (!activeSession?.itemId) {
      throw createError({ statusCode: 400, message: 'No active session found. Pass taskId to link this commit manually.' })
    }

    const task = await requireAssignedTask(agent.id, activeSession.itemId)
    itemId = task.id
    sessionId = activeSession.id
  }

  const repoPath = await resolveRepoPath(itemId)
  const commitInfo = await getCommitInfo(repoPath, sha)

  try {
    const created = await prisma.commit.create({
      data: {
        sha: commitInfo.sha,
        message: commitInfo.message,
        branch: commitInfo.branch,
        filesChanged: commitInfo.filesChanged,
        insertions: commitInfo.insertions,
        deletions: commitInfo.deletions,
        diffSummary: commitInfo.diffSummary as Prisma.InputJsonValue,
        itemId,
        sessionId,
        authorId: agent.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            isAgent: true,
          },
        },
        item: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    })

    return {
      id: created.id,
      sha: created.sha,
      shortSha: created.sha.slice(0, 7),
      message: created.message,
      branch: created.branch,
      filesChanged: created.filesChanged,
      insertions: created.insertions,
      deletions: created.deletions,
      diffSummary: created.diffSummary,
      item: created.item,
      author: {
        id: created.author.id,
        name: created.author.name ?? 'Unknown',
        isAgent: created.author.isAgent,
      },
      createdAt: created.createdAt.toISOString(),
    }
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError({ statusCode: 409, message: 'This commit is already linked to the task' })
    }
    throw error
  }
})
