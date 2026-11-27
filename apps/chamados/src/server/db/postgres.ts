import { SQL } from 'bun'
import { POSTGRES_SCHEMA } from './schema'

let client: SQL | null = null

export function usesPostgres(): boolean {
  const hasUrl = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0)
  const hasPassword = Boolean(process.env.PGPASSWORD && process.env.PGPASSWORD.length > 0)
  return hasUrl || hasPassword
}

function migrationStatements(text: string): string[] {
  return text
    .split(';\n')
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)
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
  for (const statement of migrationStatements(POSTGRES_SCHEMA)) {
    await sql.unsafe(statement)
  }
  client = sql
  return client
}

export function getPostgres(): SQL {
  if (!client) {
    throw new Error('Postgres não inicializado')
  }
  return client
}