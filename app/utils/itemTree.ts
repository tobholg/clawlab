import type { ItemNode } from '~/types'

export interface DescendantPathEntry {
  item: ItemNode
  path: ItemNode[]
}

export function flattenDescendants(root: ItemNode, maxDepth = 4): DescendantPathEntry[] {
  const results: DescendantPathEntry[] = []

  const walk = (node: ItemNode, path: ItemNode[], depth: number) => {
    if (!node.children?.length) return
    for (const child of node.children) {
      const nextPath = [...path, child]
      results.push({ item: child, path: nextPath })
      if (depth < maxDepth) {
        walk(child, nextPath, depth + 1)
      }
    }
  }

  walk(root, [root], 0)
  return results
}
