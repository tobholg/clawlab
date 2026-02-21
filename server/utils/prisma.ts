import { randomUUID } from 'crypto'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient as PostgresPrismaClient } from '@prisma/client'
import { createRequire } from 'module'
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const SQLITE_DB_FILE = './data/context.db'
const SQLITE_DB_URL = `file:${SQLITE_DB_FILE}`
const POSTGRES_MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations')
const SQLITE_MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations-sqlite')

type PrismaClient = PostgresPrismaClient
const require = createRequire(import.meta.url)
const { PrismaClient: SqlitePrismaClient } = require('.prisma/client-sqlite') as {
  PrismaClient: new (options?: any) => PostgresPrismaClient
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  sqliteDb: any | undefined
}

interface MigrationRow {
  migration_name: string
}

function getMigrationFolders(migrationsDir: string): string[] {
  if (!existsSync(migrationsDir)) return []
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
}

function readMigrationSQL(migrationsDir: string, folderName: string): string | null {
  const sqlPath = join(migrationsDir, folderName, 'migration.sql')
  if (!existsSync(sqlPath)) return null
  return readFileSync(sqlPath, 'utf-8')
}

async function runPostgresMigrations(
  exec: (sql: string) => Promise<void>,
  query: <T = any>(sql: string) => Promise<{ rows: T[] }>,
  migrationsDir: string
): Promise<void> {
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

  const applied = await query<MigrationRow>(
    `SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name`
  )
  const appliedSet = new Set(applied.rows.map(r => r.migration_name))

  const folders = getMigrationFolders(migrationsDir)
  let newCount = 0

  for (const folder of folders) {
    if (appliedSet.has(folder)) continue

    const sql = readMigrationSQL(migrationsDir, folder)
    if (!sql) continue

    const safeFolderName = folder.replace(/'/g, "''")

    console.log(`[context] Applying migration: ${folder}`)
    try {
      await exec('BEGIN')
      await exec(sql)
      await exec(`
        INSERT INTO "_prisma_migrations" (migration_name, finished_at, applied_steps_count)
        VALUES ('${safeFolderName}', now(), 1)
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

function runSqliteMigrations(db: any, migrationsDir: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" TEXT PRIMARY KEY,
      "migration_name" TEXT NOT NULL UNIQUE,
      "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finished_at" DATETIME,
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
      "logs" TEXT
    )
  `)

  const appliedRows = db
    .prepare(`SELECT migration_name FROM "_prisma_migrations" ORDER BY migration_name`)
    .all() as MigrationRow[]
  const appliedSet = new Set(appliedRows.map(r => r.migration_name))

  const folders = getMigrationFolders(migrationsDir)
  let newCount = 0

  for (const folder of folders) {
    if (appliedSet.has(folder)) continue

    const sql = readMigrationSQL(migrationsDir, folder)
    if (!sql) continue

    console.log(`[context] Applying migration: ${folder}`)
    try {
      db.exec('BEGIN')
      db.exec(sql)
      db.prepare(`
        INSERT INTO "_prisma_migrations" (id, migration_name, finished_at, applied_steps_count)
        VALUES (?, ?, CURRENT_TIMESTAMP, 1)
      `).run(randomUUID(), folder)
      db.exec('COMMIT')
      newCount++
    } catch (e: any) {
      try {
        db.exec('ROLLBACK')
      } catch {
        // no-op
      }
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

async function initSqlite() {
  const { default: BetterSqlite3 } = await import('better-sqlite3')

  if (!globalForPrisma.sqliteDb) {
    mkdirSync('./data', { recursive: true })
    globalForPrisma.sqliteDb = new BetterSqlite3(SQLITE_DB_FILE)
    runSqliteMigrations(globalForPrisma.sqliteDb, SQLITE_MIGRATIONS_DIR)
  }

  return new PrismaBetterSqlite3({ url: SQLITE_DB_URL })
}

async function initRealPostgres(connectionString: string) {
  const adapter = new PrismaPg({ connectionString })

  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString })
  await client.connect()

  try {
    await runPostgresMigrations(
      (sql) => client.query(sql).then(() => {}),
      async (sql) => {
        const result = await client.query(sql)
        return { rows: result.rows }
      },
      POSTGRES_MIGRATIONS_DIR
    )
  } finally {
    await client.end()
  }

  return adapter
}

export async function initPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  if (process.env.DATABASE_URL) {
    console.log('[context] Using PostgreSQL database')
    const adapter = await initRealPostgres(process.env.DATABASE_URL)
    const client = new PostgresPrismaClient({ adapter })
    globalForPrisma.prisma = client
    return client
  }

  console.log('[context] No DATABASE_URL - using embedded SQLite')
  const adapter = await initSqlite()
  const client = new SqlitePrismaClient({ adapter }) as unknown as PrismaClient
  globalForPrisma.prisma = client
  return client
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      throw new Error(
        '[context] Prisma not initialized yet. This should not happen - check server/plugins/01.prisma.ts'
      )
    }
    return (globalForPrisma.prisma as any)[prop]
  },
})
