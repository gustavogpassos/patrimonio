import { AsyncLocalStorage } from 'node:async_hooks'
import type { SQL } from 'bun'
import { openPostgres, usesPostgres } from './postgres'
import { getDb } from './sqlite'

const txStore = new AsyncLocalStorage<SQL>()

let sqliteQueue: Promise<unknown> = Promise.resolve()
let inSqliteTx = false

type SqliteStatement = {
  all: (...args: unknown[]) => unknown[]
  get: (...args: unknown[]) => unknown
  run: (...args: unknown[]) => { lastInsertRowid: number | bigint; changes: number }
}

export type RunResult = {
  lastInsertRowid: number | bigint
  changes: number
}

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = sqliteQueue.then(fn, fn)
  sqliteQueue = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

function sqlite<T>(fn: () => T): Promise<T> {
  if (inSqliteTx) return Promise.resolve(fn())
  return enqueue(async () => fn())
}

function rewrite(sql: string): string {
  if (!usesPostgres()) return sql
  let text = sql.replaceAll(
    "datetime('now','localtime')",
    "to_char(now(), 'YYYY-MM-DD HH24:MI:SS')",
  )
  text = text.replaceAll('ifnull(', 'COALESCE(')
  text = text.replaceAll(' COLLATE NOCASE', '')
  text = text.replaceAll("GLOB 'PAT-[0-9]*'", "~ '^PAT-[0-9]'")
  let index = 0
  text = text.replaceAll('?', () => {
    index += 1
    return `$${index}`
  })
  return text
}

async function pg(): Promise<SQL> {
  const current = txStore.getStore()
  if (current) return current
  return openPostgres(process.env.DATABASE_URL)
}

function statement(sql: string): SqliteStatement {
  return getDb().query(sql) as unknown as SqliteStatement
}

function affected(rows: unknown): number {
  if (rows && typeof rows === 'object' && 'count' in rows) {
    const count = (rows as { count: unknown }).count
    if (typeof count === 'number') return count
  }
  return Array.isArray(rows) ? rows.length : 0
}

export async function all<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  if (!usesPostgres()) {
    const rows = await sqlite(() => statement(sql).all(...params))
    return rows as T[]
  }
  const client = await pg()
  const rows = await client.unsafe(rewrite(sql), params)
  return (Array.isArray(rows) ? rows : []) as T[]
}

export async function get<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  if (!usesPostgres()) {
    const row = await sqlite(() => statement(sql).get(...params))
    return (row ?? null) as T | null
  }
  const rows = await all<T>(sql, ...params)
  return rows[0] ?? null
}

export async function run(sql: string, ...params: unknown[]): Promise<RunResult> {
  if (!usesPostgres()) {
    return sqlite(() => {
      const result = statement(sql).run(...params)
      return { lastInsertRowid: result.lastInsertRowid, changes: result.changes }
    })
  }
  let text = sql
  const isInsert = /^\s*insert\b/i.test(text)
  const hasReturning = /\breturning\b/i.test(text)
  if (isInsert && !hasReturning) {
    text = `${text} RETURNING id`
  }
  const client = await pg()
  const rows = (await client.unsafe(rewrite(text), params)) as Array<{
    id?: number | string | bigint
  }>
  const id = Array.isArray(rows) ? rows[0]?.id : undefined
  return {
    lastInsertRowid: id == null ? 0 : Number(id),
    changes: affected(rows),
  }
}

export async function exec(sql: string): Promise<void> {
  if (!usesPostgres()) {
    await sqlite(() => {
      getDb().exec(sql)
    })
    return
  }
  const client = await pg()
  await client.unsafe(rewrite(sql))
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (!usesPostgres()) {
    return enqueue(async () => {
      const db = getDb()
      db.exec('BEGIN IMMEDIATE')
      inSqliteTx = true
      try {
        const result = await fn()
        db.exec('COMMIT')
        return result
      } catch (err) {
        try {
          db.exec('ROLLBACK')
        } catch {
          // a transação já foi encerrada
        }
        throw err
      } finally {
        inSqliteTx = false
      }
    })
  }
  const client = await pg()
  return client.begin(async (tx) => txStore.run(tx, fn))
}
