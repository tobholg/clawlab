import { prisma } from './prisma'

const MENTION_PATTERN = /<@([a-zA-Z0-9_-]+)>/g

export function extractMentionIds(content: string): string[] {
  const ids: string[] = []
  let match: RegExpExecArray | null

  while ((match = MENTION_PATTERN.exec(content)) !== null) {
    ids.push(match[1])
  }

  return [...new Set(ids)]
}

export async function createMentions(messageId: string, content: string): Promise<void> {
  const userIds = extractMentionIds(content)
  if (userIds.length === 0) return

  const validUsers = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true },
  })

  if (validUsers.length === 0) return

  await prisma.messageMention.createMany({
    data: validUsers.map((user) => ({
      messageId,
      userId: user.id,
    })),
    skipDuplicates: true,
  })
}

export function renderMentionsForDisplay(content: string, userMap: Map<string, string>): string {
  return content.replace(MENTION_PATTERN, (_match, userId: string) => {
    const name = userMap.get(userId)
    return name ? `@${name}` : '@unknown'
  })
}
