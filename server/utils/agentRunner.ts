const DEFAULT_RUNNER_BY_PROVIDER: Record<string, string> = {
  codex: 'codex',
}

function normalize(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.toLowerCase() : null
}

export function defaultRunnerCommandForProvider(provider: string | null | undefined): string | null {
  const key = normalize(provider)
  if (!key) return null
  return DEFAULT_RUNNER_BY_PROVIDER[key] ?? null
}

export function resolveRunnerCommand(
  explicitRunner: string | null | undefined,
  provider: string | null | undefined,
): string | null {
  const normalizedRunner = normalize(explicitRunner)
  if (normalizedRunner) return normalizedRunner
  return defaultRunnerCommandForProvider(provider)
}
