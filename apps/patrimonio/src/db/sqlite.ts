import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { migrate } from './migrate'

let db: Database | null = null
let dbPath =
  process.env.PATRIMONIO_DB ?? join(process.cwd(), 'data', 'patrimonio.db')

export function getDbPath() {
  return dbPath
}

export function setDbPath(path: string) {
  dbPath = path
}

function configure(connection: Database) {
  connection.exec('PRAGMA foreign_keys = ON')
  connection.exec('PRAGMA journal_mode = WAL')
}

export function openDatabase(path = dbPath): Database {
  mkdirSync(dirname(path), { recursive: true })
  const connection = new Database(path, { create: true })
  configure(connection)
  migrate(connection)
  return connection
}

export function getDb(): Database {
  if (!db) {
    db = openDatabase(dbPath)
  }
  return db
}

export function reopenDatabase(path = dbPath) {
  if (db) {
    try {
      db.close()
    } catch {
      // ignore
    }
  }
  dbPath = path
  db = openDatabase(path)
  return db
}

export function closeDb() {
  if (db) {
    db.close()
    db = null
  }
}

export function useTestDatabase(path: string) {
  closeDb()
  dbPath = path
  db = openDatabase(path)
  return db
}

export function nullIfEmpty(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  return t.length === 0 ? null : t
}
