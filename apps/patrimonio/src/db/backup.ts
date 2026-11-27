import { Database } from 'bun:sqlite'
import { copyFileSync, existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppError } from './errors'
import { usesPostgres } from './postgres'
import { all, exec, run, transaction } from './sql'
import { closeDb, getDb, getDbPath, reopenDatabase } from './sqlite'

const TABLES = ['categories', 'sectors', 'equipment', 'transfers', 'maintenance'] as const

type Dump = Record<(typeof TABLES)[number], Array<Record<string, unknown>>>

export async function readDatabaseFile(): Promise<Uint8Array> {
  if (usesPostgres()) {
    const payload = {} as Dump
    for (const table of TABLES) {
      payload[table] = await all<Record<string, unknown>>(
        `SELECT * FROM ${table} ORDER BY id`,
      )
    }
    return new TextEncoder().encode(JSON.stringify(payload))
  }

  const db = getDb()
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  return new Uint8Array(await Bun.file(getDbPath()).bytes())
}

async function insertDump(table: (typeof TABLES)[number], rows: Array<Record<string, unknown>>) {
  for (const row of rows) {
    const columns = Object.keys(row)
    if (columns.length === 0) continue
    const placeholders = columns.map(() => '?').join(', ')
    await run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      ...columns.map((column) => row[column] ?? null),
    )
  }
  await exec(`SELECT setval(
    pg_get_serial_sequence('${table}', 'id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM ${table}), 1), 1),
    COALESCE((SELECT MAX(id) FROM ${table}), 0) > 0
  )`)
}

export async function importDatabase(bytes: Uint8Array) {
  if (usesPostgres()) {
    let parsed: Partial<Dump>
    try {
      parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<Dump>
    } catch {
      throw new AppError('Arquivo não é um banco do Patrimônio.')
    }
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.equipment)) {
      throw new AppError('Arquivo não é um banco do Patrimônio.')
    }
    await transaction(async () => {
      await exec('DELETE FROM maintenance')
      await exec('DELETE FROM transfers')
      await exec('DELETE FROM equipment')
      await exec('DELETE FROM sectors')
      await exec('DELETE FROM categories')
      for (const table of TABLES) {
        const rows = parsed[table]
        if (!Array.isArray(rows)) continue
        await insertDump(table, rows)
      }
    })
    return
  }

  const tempPath = join(tmpdir(), `patrimonio-restore-${Date.now()}.db`)
  await Bun.write(tempPath, bytes)

  try {
    const probe = new Database(tempPath, { readonly: true })
    try {
      const row = probe
        .query<{ name: string }, []>(
          // `equipamentos` is the table name from before the English schema migration.
          `SELECT name FROM sqlite_master
           WHERE type='table' AND name IN ('equipment', 'equipamentos')`,
        )
        .get()
      if (!row) {
        throw new AppError('Arquivo não é um banco do Patrimônio.')
      }
    } finally {
      probe.close()
    }

    const target = getDbPath()
    closeDb()

    if (existsSync(target)) unlinkSync(target)
    for (const suffix of ['-wal', '-shm']) {
      const p = `${target}${suffix}`
      if (existsSync(p)) unlinkSync(p)
    }

    copyFileSync(tempPath, target)
    reopenDatabase(target)
  } catch (err) {
    // try to reopen existing db if restore failed mid-way
    try {
      reopenDatabase(getDbPath())
    } catch {
      // ignore
    }
    if (err instanceof AppError) throw err
    throw new AppError('Arquivo não é um banco do Patrimônio.')
  } finally {
    if (existsSync(tempPath)) unlinkSync(tempPath)
  }
}
