// Seed test messages into a channel for missed-message UX testing.
// Usage:
// npx tsx scripts/seed-channel-messages.ts --channel cml9ljj5q0005mi1tgtzbuz0o --count 8

import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

function parseArg(name: string): string | undefined {
  const index = process.argv.findIndex(arg => arg === `--${name}`)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function toCount(raw: string | undefined): number {
  const parsed = Number.parseInt(raw || '8', 10)
  if (Number.isNaN(parsed)) return 8
  return Math.max(5, Math.min(10, parsed))
}

const DEMO_LINES = [
  'Quick status: dependency review completed, no blockers found.',
  'Heads up: we should confirm release notes before EOD.',
  'I validated the latest build and noted one flaky check.',
  'Drafted a short update for stakeholders; feedback welcome.',
  'Can someone sanity-check the rollout timing for tomorrow?',
  'Follow-up: API responses look stable after the last patch.',
  'I documented the edge case we discussed in standup.',
  'Flagging a minor risk around onboarding email delays.',
  'Proposal: split this into two smaller execution steps.',
  'I can pair on this after lunch if needed.',
]

async function main() {
  const channelId = parseArg('channel')
  const count = toCount(parseArg('count'))

  if (!channelId) {
    throw new Error('Missing required argument: --channel <channelId>')
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      members: {
        select: { userId: true },
      },
    },
  })

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`)
  }

  let authorIds = channel.members.map(member => member.userId)

  if (authorIds.length === 0) {
    const fallbackMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId: channel.workspaceId },
      select: { userId: true },
      take: 5,
    })
    authorIds = fallbackMembers.map(member => member.userId)
  }

  if (authorIds.length === 0) {
    throw new Error('No available users found to author demo messages')
  }

  const now = Date.now()
  const inserted: { id: string; createdAt: Date; userId: string }[] = []

  for (let i = 0; i < count; i++) {
    const authorId = authorIds[i % authorIds.length]
    const createdAt = new Date(now - (count - 1 - i) * 1_000)
    const line = DEMO_LINES[i % DEMO_LINES.length]
    const content = `[Demo catch-up ${i + 1}/${count}] ${line}`

    const message = await prisma.message.create({
      data: {
        channelId: channel.id,
        userId: authorId,
        content,
        parentId: null,
        createdAt,
      },
      select: {
        id: true,
        createdAt: true,
        userId: true,
      },
    })

    inserted.push(message)
  }

  console.log(`Inserted ${inserted.length} demo messages into channel ${channel.id}`)
  console.log('Newest message timestamp:', inserted[inserted.length - 1]?.createdAt.toISOString())
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
