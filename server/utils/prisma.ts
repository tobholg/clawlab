import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'
import { mkdirSync } from 'fs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgliteInstance: any | undefined
}

async function initPGlite() {
  const { PGlite } = await import('@electric-sql/pglite')
  const { PrismaPGlite } = await import('pglite-prisma-adapter')

  const dataDir = './data/pglite'

  if (!globalForPrisma.pgliteInstance) {
    mkdirSync(dataDir, { recursive: true })
    const pg = new PGlite(dataDir)
    globalForPrisma.pgliteInstance = pg

    // Check if schema has been applied by looking for tables in pg_catalog
    const result = await pg.query(
      `SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' LIMIT 1`
    )
    const schemaExists = result.rows.length > 0

    if (schemaExists) {
      console.log('[context] PGlite database loaded from', dataDir)
    } else {
      console.log('[context] Initializing PGlite schema...')
      try {
        const sql = execSync(
          'npx prisma migrate diff --from-empty --to-schema ./prisma/schema.prisma --script',
          {
            encoding: 'utf-8',
            cwd: process.cwd(),
            env: { ...process.env, DATABASE_URL: 'postgresql://localhost:5432/placeholder' },
          }
        )
        // Wrap in transaction so partial failures roll back cleanly
        await pg.exec(`BEGIN;\n${sql}\nCOMMIT;`)
        console.log('[context] PGlite schema applied successfully')
      } catch (e) {
        await pg.exec('ROLLBACK').catch(() => {})
        console.error('[context] Failed to apply schema to PGlite:', e)
        throw e
      }
    }
  }

  const adapter = new PrismaPGlite(globalForPrisma.pgliteInstance)
  return adapter
}

export async function initPrisma(): Promise<PrismaClient> {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  let adapter: any

  if (process.env.DATABASE_URL) {
    console.log('[context] Using PostgreSQL database')
    adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
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
