import { execSync } from 'node:child_process'
import { prisma } from './prisma'

export type CommitDiffFile = {
  file: string
  insertions: number
  deletions: number
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'type_changed' | 'unmerged' | 'unknown'
}

export type CommitInfo = {
  sha: string
  message: string
  authorName: string
  authoredAt: string
  branch: string | null
  filesChanged: number
  insertions: number
  deletions: number
  diffSummary: CommitDiffFile[]
}

function shellEscape(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function mapStatus(code: string): CommitDiffFile['status'] {
  const normalized = code.trim().charAt(0).toUpperCase()
  if (normalized === 'A') return 'added'
  if (normalized === 'M') return 'modified'
  if (normalized === 'D') return 'deleted'
  if (normalized === 'R') return 'renamed'
  if (normalized === 'C') return 'copied'
  if (normalized === 'T') return 'type_changed'
  if (normalized === 'U') return 'unmerged'
  return 'unknown'
}

function parseNumstat(output: string) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [insRaw = '0', delRaw = '0', ...rest] = line.split('\t')
      const file = rest.join('\t')
      const insertions = /^\d+$/.test(insRaw) ? Number(insRaw) : 0
      const deletions = /^\d+$/.test(delRaw) ? Number(delRaw) : 0
      return { file, insertions, deletions }
    })
}

function parseNameStatus(output: string) {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [statusRaw = '', first = '', second = ''] = line.split('\t')
      const status = mapStatus(statusRaw)
      const file = status === 'renamed' || status === 'copied' ? second : first
      return { file, status }
    })
}

function runGitCommand(repoPath: string, command: string) {
  return execSync(command, {
    cwd: repoPath,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export async function resolveRepoPath(itemId: string): Promise<string> {
  let currentId: string | null = itemId
  const visited = new Set<string>()

  while (currentId) {
    if (visited.has(currentId)) {
      throw createError({ statusCode: 500, message: 'Detected cycle while resolving repository path' })
    }
    visited.add(currentId)

    const item = await prisma.item.findUnique({
      where: { id: currentId },
      select: { id: true, parentId: true, repoPath: true },
    })

    if (!item) {
      throw createError({ statusCode: 404, message: 'Task not found' })
    }

    if (item.repoPath && item.repoPath.trim()) {
      return item.repoPath.trim()
    }

    currentId = item.parentId
  }

  throw createError({
    statusCode: 400,
    message: 'No repository configured for this task. Set repoPath on the task or a parent item.',
  })
}

export async function getCommitInfo(repoPath: string, sha: string): Promise<CommitInfo> {
  const normalizedSha = sha.trim()
  if (!normalizedSha) {
    throw createError({ statusCode: 400, message: 'sha is required' })
  }

  const escapedSha = shellEscape(normalizedSha)

  try {
    const logOutput = runGitCommand(
      repoPath,
      `git log -1 --format='%H%n%s%n%an%n%aI' ${escapedSha}`
    )
    const [resolvedSha = '', message = '', authorName = '', authoredAt = ''] = logOutput.split('\n')

    if (!resolvedSha) {
      throw createError({ statusCode: 404, message: 'Commit not found in configured repository' })
    }

    const branchRaw = runGitCommand(repoPath, 'git rev-parse --abbrev-ref HEAD')
    const branch = branchRaw && branchRaw !== 'HEAD' ? branchRaw : null

    const range = `${normalizedSha}^..${normalizedSha}`
    let numstatOutput = ''
    let statusOutput = ''

    try {
      numstatOutput = runGitCommand(repoPath, `git diff --numstat ${shellEscape(range)}`)
      statusOutput = runGitCommand(repoPath, `git diff --name-status ${shellEscape(range)}`)
    } catch {
      // Initial/root commits do not have <sha>^, so use show as a fallback.
      numstatOutput = runGitCommand(repoPath, `git show --format= --numstat ${escapedSha}`)
      statusOutput = runGitCommand(repoPath, `git show --format= --name-status ${escapedSha}`)
    }

    const numstat = parseNumstat(numstatOutput)
    const statuses = parseNameStatus(statusOutput)
    const statusByFile = new Map(statuses.map((entry) => [entry.file, entry.status]))

    const diffSummary: CommitDiffFile[] = numstat.map((entry, index) => ({
      file: entry.file,
      insertions: entry.insertions,
      deletions: entry.deletions,
      status: statusByFile.get(entry.file) ?? statuses[index]?.status ?? 'modified',
    }))

    const filesChanged = diffSummary.length
    const insertions = diffSummary.reduce((sum, file) => sum + file.insertions, 0)
    const deletions = diffSummary.reduce((sum, file) => sum + file.deletions, 0)

    return {
      sha: resolvedSha,
      message,
      authorName,
      authoredAt,
      branch,
      filesChanged,
      insertions,
      deletions,
      diffSummary,
    }
  } catch (error: any) {
    const stderr = String(error?.stderr || '')
    if (
      stderr.includes('bad object') ||
      stderr.includes('unknown revision') ||
      stderr.includes('ambiguous argument') ||
      stderr.includes('bad revision')
    ) {
      throw createError({ statusCode: 404, message: 'Commit not found in configured repository' })
    }

    if (error?.statusCode && error?.message) {
      throw error
    }

    throw createError({ statusCode: 400, message: 'Failed to read commit information from repository' })
  }
}
