import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgliteInstance: any | undefined
}

// ---------------------------------------------------------------------------
// Migration runner — works for both PGlite and real Postgres
// Reads prisma/migrations/*/migration.sql and applies them in order,
// tracking state in a _prisma_migrations table (same name Prisma uses).
// ---------------------------------------------------------------------------

interface MigrationRow {
  migration_name: string
}

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations')

function getMigrationFolders(): string[] {
  if (!existsSync(MIGRATIONS_DIR)) return []
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort() // timestamp-prefixed names sort chronologically
}

function readMigrationSQL(folderName: string): string | null {
  const sqlPath = join(MIGRATIONS_DIR, folderName, 'migration.sql')
  if (!existsSync(sqlPath)) return null
  return readFileSync(sqlPath, 'utf-8')
}

async function runMigrations(
  exec: (sql: string) => Promise<void>,
  query: <T = any>(sql: string) => Promise<{ rows: T[] }>
): Promise<void> {
  // Ensure tracking table exists
  await exec(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "migration_name"      TEXT NOT NULL UNIQUE,
      "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
      "finished_at"         TIMESTAMPTZ,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
      "logs"                TEXT
    )
  `)

  // What's already applied?
  const applied = await query<MigrationRow>(
    `SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name`
  )
  const appliedSet = new Set(applied.rows.map(r => r.migration_name))

  const folders = getMigrationFolders()
  let newCount = 0

  for (const folder of folders) {
    if (appliedSet.has(folder)) continue

    const sql = readMigrationSQL(folder)
    if (!sql) continue

    console.log(`[context] Applying migration: ${folder}`)
    try {
      await exec('BEGIN')
      await exec(sql)
      await exec(`
        INSERT INTO "_prisma_migrations" (migration_name, finished_at, applied_steps_count)
        VALUES ('${folder}', now(), 1)
      `)
      await exec('COMMIT')
      newCount++
    } catch (e: any) {
      await exec('ROLLBACK').catch(() => {})
      console.error(`[context] Migration ${folder} failed:`, e?.message || e)
      throw new Error(`Migration ${folder} failed: ${e?.message || e}`)
    }
  }

  if (newCount > 0) {
    console.log(`[context] Applied ${newCount} migration(s)`)
  } else {
    console.log('[context] Database schema is up to date')
  }
}

// ---------------------------------------------------------------------------
// PGlite initializer
// ---------------------------------------------------------------------------

async function initPGlite() {
  const { PGlite } = await import('@electric-sql/pglite')
  const { PrismaPGlite } = await import('pglite-prisma-adapter')

  const dataDir = './data/pglite'

  if (!globalForPrisma.pgliteInstance) {
    mkdirSync(dataDir, { recursive: true })
    const pg = new PGlite(dataDir)
    globalForPrisma.pgliteInstance = pg

    await runMigrations(
      (sql) => pg.exec(sql).then(() => {}),
      (sql) => pg.query(sql)
    )
  }

  const adapter = new PrismaPGlite(globalForPrisma.pgliteInstance)
  return adapter
}

// ---------------------------------------------------------------------------
// Real Postgres initializer
// ---------------------------------------------------------------------------

async function initRealPostgres(connectionString: string) {
  const adapter = new PrismaPg({ connectionString })

  // For real Postgres, we can run migrations through a temporary pg client
  // to avoid mixing Prisma adapter internals with raw SQL.
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString })
  await client.connect()

  try {
    await runMigrations(
      (sql) => client.query(sql).then(() => {}),
      async (sql) => {
        const result = await client.query(sql)
        return { rows: result.rows }
      }
    )
  } finally {
    await client.end()
  }

  return adapter
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function initPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  let adapter: any

  if (process.env.DATABASE_URL) {
    console.log('[context] Using PostgreSQL database')
    adapter = await initRealPostgres(process.env.DATABASE_URL)
  } else {
    console.log('[context] No DATABASE_URL — using embedded PGlite')
    adapter = await initPGlite()
  }

  const client = new PrismaClient({ adapter })
  globalForPrisma.prisma = client
  return client
}

// Synchronous accessor — used by all API routes
// The Nitro plugin (server/plugins/01.prisma.ts) ensures initPrisma()
// completes before any requests are handled
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      throw new Error(
        '[context] Prisma not initialized yet. This should not happen — check server/plugins/01.prisma.ts'
      )
    }
    return (globalForPrisma.prisma as any)[prop]
  },
})
