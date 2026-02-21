import { prisma } from '../../../utils/prisma'
import { requireWorkspaceMemberForItem } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const itemId = getRouterParam(event, 'id')

  if (!itemId) {
    throw createError({ statusCode: 400, message: 'Item ID is required' })
  }

  await requireWorkspaceMemberForItem(event, itemId)

  const commits = await prisma.commit.findMany({
    where: { itemId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          isAgent: true,
        },
      },
    },
  })

  return {
    commits: commits.map((commit) => ({
      id: commit.id,
      sha: commit.sha,
      shortSha: commit.sha.slice(0, 7),
      message: commit.message,
      branch: commit.branch,
      filesChanged: commit.filesChanged,
      insertions: commit.insertions,
      deletions: commit.deletions,
      diffSummary: commit.diffSummary ?? [],
      author: {
        id: commit.author.id,
        name: commit.author.name ?? commit.author.email.split('@')[0],
        isAgent: commit.author.isAgent,
      },
      createdAt: commit.createdAt.toISOString(),
    })),
  }
})
