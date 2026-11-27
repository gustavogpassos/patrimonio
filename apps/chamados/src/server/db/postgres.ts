import { SQL } from 'bun'
import { POSTGRES_SCHEMA } from './schema'

let client: SQL | null = null

function migrationStatements(text: string): string[] {
  return text
    .split(';\n')
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0)
}

export async function openPostgres(databaseUrl: string): Promise<SQL> {
  if (client) return client

  const sql = new SQL(databaseUrl)
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