import { SQL } from 'bun'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let client: SQL | null = null

export function usesPostgres(): boolean {
  const hasUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0)
  const hasPassword = Boolean(process.env.PGPASSWORD && process.env.PGPASSWORD.length > 0)
  const dbUnset = !process.env.PATRIMONIO_DB || process.env.PATRIMONIO_DB.length === 0
  return (hasUrl || hasPassword) && dbUnset
}

function migrationDescription(version: number): string {
  if (version === 1) return 'schema postgres'
  return `migration ${version}`
}

async function ensureSchemaMigrations(sql: SQL) {
  await sql.unsafe(`
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TEXT NOT NULL
)
`)
}

function migrationStatements(text: string): string[] {
  return text
    .split(';\n')
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)
}

async function applyMigrations(sql: SQL) {
  await ensureSchemaMigrations(sql)

  const appliedRows = await sql`SELECT version FROM schema_migrations`
  const applied = new Set(
    (Array.isArray(appliedRows) ? appliedRows : []).map(
      (r: { version: number }) => r.version,
    ),
  )

  const dir = join(import.meta.dir, 'migrations-pg')
  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const version = parseInt(file.match(/^(\d+)/)?.[1] ?? '0', 10)
    if (!version || applied.has(version)) continue

    const text = readFileSync(join(dir, file), 'utf8')
    const description = migrationDescription(version)
    const statements = migrationStatements(text)
    await sql.begin(async (tx) => {
      for (const statement of statements) {
        await tx.unsafe(statement)
      }
      await tx`INSERT INTO schema_migrations (version, description, applied_at) VALUES (${version}, ${description}, to_char(now(), 'YYYY-MM-DD HH24:MI:SS'))`
    })
  }
}

export async function openPostgres(databaseUrl?: string): Promise<SQL> {
  if (client) return client

  const password = process.env.PGPASSWORD
  const sql =
    password && password.length > 0
      ? new SQL({
          hostname: process.env.PGHOST,
          port: 5432,
          username: process.env.PGUSER,
          password,
          database: process.env.PGDATABASE,
        })
      : new SQL(databaseUrl ?? process.env.DATABASE_URL!)
  await applyMigrations(sql)
  client = sql
  return client
}

export function getPostgres(): SQL {
  if (!client) {
    throw new Error('Postgres não inicializado')
  }
  return client
}

export async function closePostgres(): Promise<void> {
  if (client) {
    await client.close()
    client = null
  }
}