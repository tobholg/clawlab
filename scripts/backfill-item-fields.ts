// Backfill script for projectId and completedAt fields
// Run with: npx tsx scripts/backfill-item-fields.ts

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function findRootProjectId(itemId: string): Promise<string | null> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, parentId: true }
  })

  if (!item) return null
  if (!item.parentId) return null // This item IS a root project

  // Walk up the tree to find root
  let currentId = item.parentId
  while (true) {
    const parent = await prisma.item.findUnique({
      where: { id: currentId },
      select: { id: true, parentId: true }
    })
    if (!parent) return currentId
    if (!parent.parentId) return parent.id // Found the root
    currentId = parent.parentId
  }
}

async function main() {
  console.log('Starting backfill...')

  // Get all items that need projectId populated
  const itemsNeedingProjectId = await prisma.item.findMany({
    where: {
      parentId: { not: null },
      projectId: null,
    },
    select: { id: true, parentId: true }
  })

  console.log(`Found ${itemsNeedingProjectId.length} items needing projectId`)

  // Build a cache of projectId mappings
  const projectIdCache = new Map<string, string | null>()

  for (const item of itemsNeedingProjectId) {
    let projectId = projectIdCache.get(item.parentId!)

    if (projectId === undefined) {
      // Not in cache, compute it
      const parent = await prisma.item.findUnique({
        where: { id: item.parentId! },
        select: { projectId: true, parentId: true }
      })

      if (parent?.projectId) {
        projectId = parent.projectId
      } else if (parent?.parentId === null) {
        // Parent is a root project
        projectId = item.parentId!
      } else {
        // Need to find root
        projectId = await findRootProjectId(item.id)
      }

      projectIdCache.set(item.parentId!, projectId)
    }

    if (projectId) {
      await prisma.item.update({
        where: { id: item.id },
        data: { projectId }
      })
    }
  }

  console.log('Finished setting projectId')

  // Set completedAt for items with status DONE
  const doneItemsNeedingCompletedAt = await prisma.item.findMany({
    where: {
      status: 'DONE',
      completedAt: null,
    },
    select: { id: true, updatedAt: true }
  })

  console.log(`Found ${doneItemsNeedingCompletedAt.length} DONE items needing completedAt`)

  for (const item of doneItemsNeedingCompletedAt) {
    await prisma.item.update({
      where: { id: item.id },
      data: { completedAt: item.updatedAt }
    })
  }

  console.log('Finished setting completedAt')
  console.log('Backfill complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
