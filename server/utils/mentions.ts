import { prisma } from './prisma'

// Matches explicit <@userId> tokens (from autocomplete)
const TOKEN_MENTION_PATTERN = /<@([a-zA-Z0-9_-]+)>/g

// Matches plain @Name text (user typed manually)
// Captures one or two words after @ (e.g. @Harriet, @Tobias Holgersen)
const PLAIN_MENTION_PATTERN = /@([A-Za-z][A-Za-z0-9]*(?:\s[A-Za-z][A-Za-z0-9]*)?)/g

export function extractMentionIds(content: string): string[] {
  const ids: string[] = []
  let match: RegExpExecArray | null

  const pattern = new RegExp(TOKEN_MENTION_PATTERN.source, 'g')
  while ((match = pattern.exec(content)) !== null) {
    ids.push(match[1])
  }

  return [...new Set(ids)]
}

export function extractPlainMentionNames(content: string): string[] {
  const names: string[] = []
  let match: RegExpExecArray | null

  // Skip anything already in <@...> tokens
  const cleaned = content.replace(TOKEN_MENTION_PATTERN, '')

  const pattern = new RegExp(PLAIN_MENTION_PATTERN.source, 'g')
  while ((match = pattern.exec(cleaned)) !== null) {
    names.push(match[1])
  }

  return [...new Set(names)]
}

export async function createMentions(messageId: string, content: string): Promise<void> {
  const resolvedUserIds = new Set<string>()

  // 1. Resolve explicit <@userId> tokens
  const tokenIds = extractMentionIds(content)
  if (tokenIds.length > 0) {
    const validUsers = await prisma.user.findMany({
      where: { id: { in: tokenIds } },
      select: { id: true },
    })
    for (const u of validUsers) resolvedUserIds.add(u.id)
  }

  // 2. Resolve plain @Name mentions by matching against user names
  const plainNames = extractPlainMentionNames(content)
  if (plainNames.length > 0) {
    for (const name of plainNames) {
      // Try exact match first (case-insensitive)
      const user = await prisma.user.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      })
      if (user) {
        resolvedUserIds.add(user.id)
        continue
      }

      // Try first-name match if it's a single word
      if (!name.includes(' ')) {
        const firstNameMatch = await prisma.user.findFirst({
          where: {
            name: { startsWith: name, mode: 'insensitive' },
          },
          select: { id: true },
        })
        if (firstNameMatch) {
          resolvedUserIds.add(firstNameMatch.id)
        }
      }
    }
  }

  if (resolvedUserIds.size === 0) return

  await prisma.messageMention.createMany({
    data: [...resolvedUserIds].map((userId) => ({
      messageId,
      userId,
    })),
    skipDuplicates: true,
  })
}

export function renderMentionsForDisplay(content: string, userMap: Map<string, string>): string {
  return content.replace(TOKEN_MENTION_PATTERN, (_match, userId: string) => {
    const name = userMap.get(userId)
    return name ? `@${name}` : '@unknown'
  })
}
