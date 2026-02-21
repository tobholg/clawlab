import { execSync } from 'node:child_process'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const repoPath = typeof body.path === 'string' ? body.path.trim() : ''

  if (!repoPath) {
    throw createError({ statusCode: 400, message: 'path is required' })
  }

  // Check if directory exists and is a git repo
  try {
    const run = (cmd: string) =>
      execSync(cmd, { cwd: repoPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

    // Verify it's a git repo
    run('git rev-parse --git-dir')

    const branch = run('git rev-parse --abbrev-ref HEAD') || 'main'

    let remoteUrl = ''
    try {
      remoteUrl = run('git remote get-url origin')
    } catch {
      // No remote configured, that's fine
    }

    // Extract repo name from path or remote
    let name = repoPath.split('/').filter(Boolean).pop() || ''
    if (remoteUrl) {
      const match = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/)
      if (match) name = match[1]
    }

    return {
      valid: true,
      name,
      branch,
      remoteUrl: remoteUrl || null,
      path: repoPath,
    }
  } catch (error: any) {
    const stderr = String(error?.stderr || '')
    if (stderr.includes('not a git repository') || stderr.includes('No such file or directory')) {
      return {
        valid: false,
        error: 'Not a git repository',
        path: repoPath,
      }
    }
    return {
      valid: false,
      error: 'Could not access path',
      path: repoPath,
    }
  }
})
