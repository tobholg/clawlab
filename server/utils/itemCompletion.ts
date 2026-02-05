import type { PrismaClient } from '@prisma/client'

type DescendantRow = { id: string; status: string }

export async function collectDescendants(
  prisma: PrismaClient,
  rootId: string,
  maxDepth?: number
): Promise<{ descendants: DescendantRow[]; truncated: boolean }> {
  const limit = typeof maxDepth === 'number' ? maxDepth : Infinity
  let depth = 0
  let frontier = [rootId]
  const descendants: DescendantRow[] = []
  let truncated = false

  while (frontier.length) {
    const children = await prisma.item.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true, status: true }
    })

    if (!children.length) break
    descendants.push(...children)
    frontier = children.map((child) => child.id)
    depth += 1

    if (depth >= limit) {
      const extra = await prisma.item.count({
        where: { parentId: { in: frontier } }
      })
      if (extra > 0) truncated = true
      break
    }
  }

  return { descendants, truncated }
}

export async function countIncompleteDescendants(prisma: PrismaClient, rootId: string) {
  const { descendants } = await collectDescendants(prisma, rootId)
  return descendants.filter((child) => child.status !== 'DONE').length
}
