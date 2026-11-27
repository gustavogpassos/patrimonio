import { afterAll, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { importSqlite } from './import-sqlite'
import { migrate } from './migrate'
import { closePostgres, openPostgres } from './postgres'

const databaseUrl = process.env.DATABASE_URL

async function resetPostgres(url: string) {
  const pg = await openPostgres(url)
  await pg`DELETE FROM maintenance`
  await pg`DELETE FROM transfers`
  await pg`DELETE FROM equipment`
  await pg`DELETE FROM sectors`
  await pg`DELETE FROM categories`
  return pg
}

if (!databaseUrl) {
  test.skip('Postgres ausente: defina DATABASE_URL', () => {})
} else {
  const dir = join(process.cwd(), 'data', 'import-sqlite-test')

  afterAll(async () => {
    await resetPostgres(databaseUrl)
    await closePostgres()
    rmSync(dir, { recursive: true, force: true })
  })

  describe('importSqlite', () => {
    test('importa o sqlite uma vez e recusa a segunda', async () => {
      mkdirSync(dir, { recursive: true })
      const path = join(dir, `t-${Date.now()}.db`)

      const writer = new Database(path, { create: true })
      migrate(writer)
      writer.exec('DELETE FROM categories')
      writer
        .query(
          `INSERT INTO categories (id, name, description, active, regular_maintenance, maintenance_interval_days, created_at, updated_at)
           VALUES (4, 'Cadeira', NULL, 1, 0, NULL, '2026-01-01 00:00:00', '2026-01-01 00:00:00')`,
        )
        .run()
      writer
        .query(
          `INSERT INTO sectors (id, name, description, active, created_at, updated_at)
           VALUES (2, 'Almoxarifado', NULL, 1, '2026-01-01 00:00:00', '2026-01-01 00:00:00')`,
        )
        .run()
      writer
        .query(
          `INSERT INTO equipment (
            id, asset_tag, name, description, category_id, sector_id, location, brand, model,
            serial_number, status, acquired_on, acquisition_value_cents, supplier, invoice,
            warranty_until, notes, write_off_reason, written_off_on, created_at, updated_at
          ) VALUES (
            7, 'ALM-1', 'Cadeira', NULL, 4, 2, NULL, NULL, NULL,
            NULL, 'in_stock', NULL, NULL, NULL, NULL,
            NULL, NULL, NULL, NULL, '2026-01-01 00:00:00', '2026-01-01 00:00:00'
          )`,
        )
        .run()
      writer.close()

      const pg = await resetPostgres(databaseUrl)

      const first = await importSqlite(path, databaseUrl)
      expect(first).toEqual({
        categories: 1,
        sectors: 1,
        equipment: 1,
        movements: 0,
        maintenance: 0,
      })

      const eqRows = await pg`SELECT id FROM equipment WHERE id = 7`
      const catRows = await pg`SELECT id FROM categories WHERE id = 4`
      const secRows = await pg`SELECT id FROM sectors WHERE id = 2`
      expect(Number((eqRows as Array<{ id: unknown }>)[0]?.id)).toBe(7)
      expect(Number((catRows as Array<{ id: unknown }>)[0]?.id)).toBe(4)
      expect(Number((secRows as Array<{ id: unknown }>)[0]?.id)).toBe(2)

      expect(existsSync(path)).toBe(true)

      const backupDir = join(dirname(path), 'backups')
      const backups = readdirSync(backupDir).filter((f) =>
        /^patrimonio-\d+\.db$/.test(f),
      )
      expect(backups.length).toBe(1)

      await expect(importSqlite(path, databaseUrl)).rejects.toThrow(
        'O Postgres já tem equipamento.',
      )

      const countAfter = await pg`SELECT count(*)::int AS c FROM equipment`
      expect((countAfter as Array<{ c: number }>)[0]?.c).toBe(1)

      const backupsAfter = readdirSync(backupDir).filter((f) =>
        /^patrimonio-\d+\.db$/.test(f),
      )
      expect(backupsAfter.length).toBe(1)
    })
  })
}