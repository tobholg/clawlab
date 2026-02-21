export function parseJsonField<T = any>(value: string | null | undefined): T | null {
  if (value == null) return null

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function toJsonField(value: any): string | null {
  if (value == null) return null
  return JSON.stringify(value)
}
