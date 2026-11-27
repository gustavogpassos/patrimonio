import { SQL } from 'bun'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

let client: SQL | null = null

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

export async function openPostgres(databaseUrl: string): Promise<SQL> {
  if (client) return client

  const sql = new SQL(databaseUrl)
  await applyMigrations(sql)
  client = sql
  return client
}

export async function closePostgres(): Promise<void> {
  if (client) {
    await client.close()
    client = null
  }
}