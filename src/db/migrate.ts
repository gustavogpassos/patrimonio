import type { Database } from 'bun:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS: Array<{ version: number; description: string; file: string }> = [
  {
    version: 1,
    description: 'schema inicial',
    file: '001_init.sql',
  },
  {
    version: 2,
    description: 'manutenção regular na categoria',
    file: '002_manutencao_regular.sql',
  },
]

export function migrate(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)

  const applied = new Set(
    db
      .query<{ version: number }, []>('SELECT version FROM schema_migrations')
      .all()
      .map((r) => r.version),
  )

  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue
    const sql = readFileSync(
      join(import.meta.dir, 'migrations', m.file),
      'utf8',
    )
    db.exec('BEGIN')
    try {
      db.exec(sql)
      db.query(
        `INSERT INTO schema_migrations (version, description, applied_at)
         VALUES (?, ?, datetime('now','localtime'))`,
      ).run(m.version, m.description)
      db.exec('COMMIT')
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
}
