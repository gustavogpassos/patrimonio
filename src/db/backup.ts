import { Database } from 'bun:sqlite'
import { copyFileSync, existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AppError } from './errors'
import { closeDb, getDb, getDbPath, reopenDatabase } from './sqlite'

export async function readDatabaseFile(): Promise<Uint8Array> {
  const db = getDb()
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  return new Uint8Array(await Bun.file(getDbPath()).bytes())
}

export async function importDatabase(bytes: Uint8Array) {
  const tempPath = join(tmpdir(), `patrimonio-restore-${Date.now()}.db`)
  await Bun.write(tempPath, bytes)

  try {
    const probe = new Database(tempPath, { readonly: true })
    try {
      const row = probe
        .query<{ name: string }, []>(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='equipamentos'`,
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
