import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { SQLITE_SCHEMA } from './schema'

let db: Database | null = null
let dbPath =
  process.env.CHAMADOS_DB ?? join(process.cwd(), 'data', 'chamados.db')

export function getDbPath() {
  return dbPath
}

function configure(connection: Database) {
  connection.exec('PRAGMA foreign_keys = ON')
  connection.exec('PRAGMA journal_mode = WAL')
  connection.exec(SQLITE_SCHEMA)
}

export function openDatabase(path = dbPath): Database {
  const defaultPath = join(process.cwd(), 'data', 'chamados.db')
  if (
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL.length > 0 &&
    (!process.env.CHAMADOS_DB || process.env.CHAMADOS_DB.length === 0) &&
    path === defaultPath
  ) {
    throw new Error('Com DATABASE_URL o chamados não abre SQLite.')
  }
  mkdirSync(dirname(path), { recursive: true })
  const connection = new Database(path, { create: true })
  configure(connection)
  return connection
}

export function getSqlite(): Database {
  if (!db) {
    db = openDatabase(dbPath)
  }
  return db
}