/**
 * Database compatibility helpers for Postgres vs SQLite.
 * SQLite doesn't support Prisma's `mode: 'insensitive'` on string filters.
 * SQLite's LIKE is case-insensitive for ASCII by default, so omitting mode is fine.
 */

const isSqlite = !process.env.DATABASE_URL

/** Case-insensitive string filter. Returns `mode: 'insensitive'` on Postgres, omits it on SQLite. */
export function insensitive() {
  return isSqlite ? {} : { mode: 'insensitive' as const }
}

/** Shorthand: { contains: value, mode?: 'insensitive' } */
export function iContains(value: string) {
  return { contains: value, ...insensitive() }
}

/** Shorthand: { equals: value, mode?: 'insensitive' } */
export function iEquals(value: string) {
  return { equals: value, ...insensitive() }
}

/** Shorthand: { startsWith: value, mode?: 'insensitive' } */
export function iStartsWith(value: string) {
  return { startsWith: value, ...insensitive() }
}
