import { SQL } from 'bun'
import { Database } from 'bun:sqlite'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { openPostgres } from './postgres'

const IDENTITY_TABLES = [
  'categories',
  'sectors',
  'equipment',
  'transfers',
  'maintenance',
] as const

function backupTimestamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    String(date.getFullYear()) +
    p(date.getMonth() + 1) +
    p(date.getDate()) +
    p(date.getHours()) +
    p(date.getMinutes()) +
    p(date.getSeconds())
  )
}

function pruneBackups(backupDir: string) {
  const files = readdirSync(backupDir)
    .filter((name) => /^patrimonio-\d+\.db$/.test(name))
    .sort()
    .reverse()
  for (const name of files.slice(5)) {
    unlinkSync(join(backupDir, name))
  }
}

function sqliteCount(db: Database, table: string): number {
  const row = db
    .query(`SELECT count(*) AS c FROM ${table}`)
    .get() as { c: number }
  return row.c
}

async function pgCount(tx: SQL, table: string): Promise<number> {
  const rows = await tx.unsafe(`SELECT count(*)::int AS c FROM ${table}`)
  const row = Array.isArray(rows) ? rows[0] : rows
  return (row as { c: number }).c
}

async function resetSequences(tx: SQL, table: (typeof IDENTITY_TABLES)[number]) {
  await tx.unsafe(`SELECT setval(
  pg_get_serial_sequence('${table}', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM ${table}), 1), 1),
  COALESCE((SELECT MAX(id) FROM ${table}), 0) > 0
)`)
}

export async function importSqlite(
  sqlitePath: string,
  databaseUrl: string,
): Promise<{
  categories: number
  sectors: number
  equipment: number
  movements: number
  maintenance: number
}> {
  if (!existsSync(sqlitePath)) {
    throw new Error('O SQLite não existe.')
  }

  const writer = new Database(sqlitePath)
  try {
    writer.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    const equipmentTable = writer
      .query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'equipment'`)
      .get()
    if (!equipmentTable) {
      throw new Error('O SQLite não está no esquema em inglês.')
    }
  } finally {
    writer.close()
  }

  const pg = await openPostgres(databaseUrl)
  const existing = await pg`SELECT count(*)::int AS c FROM equipment`
  const equipmentExisting = (Array.isArray(existing) ? existing[0] : existing) as {
    c: number
  }
  if (equipmentExisting.c > 0) {
    throw new Error('O Postgres já tem equipamento.')
  }

  const backupDir = join(dirname(sqlitePath), 'backups')
  mkdirSync(backupDir, { recursive: true })
  const backupName = `patrimonio-${backupTimestamp(new Date())}.db`
  copyFileSync(sqlitePath, join(backupDir, backupName))
  pruneBackups(backupDir)

  const sqlite = new Database(sqlitePath, { readonly: true })

  try {
    const categories = sqlite
      .query(
        `SELECT id, name, description, active, regular_maintenance, maintenance_interval_days, created_at, updated_at FROM categories`,
      )
      .all() as Array<{
      id: number
      name: string
      description: string | null
      active: number
      regular_maintenance: number
      maintenance_interval_days: number | null
      created_at: string
      updated_at: string
    }>

    const sectors = sqlite
      .query(
        `SELECT id, name, description, active, created_at, updated_at FROM sectors`,
      )
      .all() as Array<{
      id: number
      name: string
      description: string | null
      active: number
      created_at: string
      updated_at: string
    }>

    const equipment = sqlite
      .query(
        `SELECT id, asset_tag, name, description, category_id, sector_id, location, brand, model, serial_number, status, acquired_on, acquisition_value_cents, supplier, invoice, warranty_until, notes, write_off_reason, written_off_on, created_at, updated_at FROM equipment`,
      )
      .all() as Array<Record<string, unknown>>

    const transfers = sqlite
      .query(
        `SELECT id, equipment_id, from_sector_id, to_sector_id, from_location, to_location, reason, transferred_on, created_at FROM transfers`,
      )
      .all() as Array<Record<string, unknown>>

    const maintenance = sqlite
      .query(
        `SELECT id, equipment_id, type, state, opened_on, completed_on, problem, solution, cost_cents, service_provider, cancellation_reason, previous_status, equipment_status_after, created_at, updated_at FROM maintenance`,
      )
      .all() as Array<Record<string, unknown>>

    const counts = await pg.begin(async (tx) => {
      await tx`DELETE FROM maintenance`
      await tx`DELETE FROM transfers`
      await tx`DELETE FROM equipment`
      await tx`DELETE FROM sectors`
      await tx`DELETE FROM categories`

      for (const row of categories) {
        await tx`INSERT INTO categories (id, name, description, active, regular_maintenance, maintenance_interval_days, created_at, updated_at) VALUES (${row.id}, ${row.name}, ${row.description}, ${row.active}, ${row.regular_maintenance}, ${row.maintenance_interval_days}, ${row.created_at}, ${row.updated_at})`
      }

      for (const row of sectors) {
        await tx`INSERT INTO sectors (id, name, description, active, created_at, updated_at) VALUES (${row.id}, ${row.name}, ${row.description}, ${row.active}, ${row.created_at}, ${row.updated_at})`
      }

      for (const row of equipment) {
        await tx`INSERT INTO equipment (id, asset_tag, name, description, category_id, sector_id, location, brand, model, serial_number, status, acquired_on, acquisition_value_cents, supplier, invoice, warranty_until, notes, write_off_reason, written_off_on, created_at, updated_at) VALUES (${row.id as number}, ${row.asset_tag as string}, ${row.name as string}, ${row.description as string | null}, ${row.category_id as number}, ${row.sector_id as number}, ${row.location as string | null}, ${row.brand as string | null}, ${row.model as string | null}, ${row.serial_number as string | null}, ${row.status as string}, ${row.acquired_on as string | null}, ${row.acquisition_value_cents as number | null}, ${row.supplier as string | null}, ${row.invoice as string | null}, ${row.warranty_until as string | null}, ${row.notes as string | null}, ${row.write_off_reason as string | null}, ${row.written_off_on as string | null}, ${row.created_at as string}, ${row.updated_at as string})`
      }

      for (const row of transfers) {
        await tx`INSERT INTO transfers (id, equipment_id, from_sector_id, to_sector_id, from_location, to_location, reason, transferred_on, created_at) VALUES (${row.id as number}, ${row.equipment_id as number}, ${row.from_sector_id as number | null}, ${row.to_sector_id as number}, ${row.from_location as string | null}, ${row.to_location as string | null}, ${row.reason as string}, ${row.transferred_on as string}, ${row.created_at as string})`
      }

      for (const row of maintenance) {
        await tx`INSERT INTO maintenance (id, equipment_id, type, state, opened_on, completed_on, problem, solution, cost_cents, service_provider, cancellation_reason, previous_status, equipment_status_after, created_at, updated_at) VALUES (${row.id as number}, ${row.equipment_id as number}, ${row.type as string}, ${row.state as string}, ${row.opened_on as string}, ${row.completed_on as string | null}, ${row.problem as string}, ${row.solution as string | null}, ${row.cost_cents as number | null}, ${row.service_provider as string | null}, ${row.cancellation_reason as string | null}, ${row.previous_status as string}, ${row.equipment_status_after as string | null}, ${row.created_at as string}, ${row.updated_at as string})`
      }

      const catSqlite = sqliteCount(sqlite, 'categories')
      const catPg = await pgCount(tx, 'categories')
      const secSqlite = sqliteCount(sqlite, 'sectors')
      const secPg = await pgCount(tx, 'sectors')
      const eqSqlite = sqliteCount(sqlite, 'equipment')
      const eqPg = await pgCount(tx, 'equipment')
      const trSqlite = sqliteCount(sqlite, 'transfers')
      const trPg = await pgCount(tx, 'transfers')
      const maSqlite = sqliteCount(sqlite, 'maintenance')
      const maPg = await pgCount(tx, 'maintenance')

      if (
        catSqlite !== catPg ||
        secSqlite !== secPg ||
        eqSqlite !== eqPg ||
        trSqlite !== trPg ||
        maSqlite !== maPg
      ) {
        throw new Error('A contagem não bate.')
      }

      for (const table of IDENTITY_TABLES) {
        await resetSequences(tx, table)
      }

      return {
        categories: catPg,
        sectors: secPg,
        equipment: eqPg,
        movements: trPg,
        maintenance: maPg,
      }
    })

    return counts
  } finally {
    sqlite.close()
  }
}