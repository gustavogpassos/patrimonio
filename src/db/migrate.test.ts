import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listCategories } from './categories'
import { migrate } from './migrate'
import { listSectors, saveSector } from './sectors'
import { closeDb, getDb, useTestDatabase } from './sqlite'

afterEach(() => {
  closeDb()
})

describe('migrations', () => {
  test('running again keeps the data and does not repeat the seed', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pat-mig-'))
    const path = join(dir, 'patrimonio.db')
    try {
      useTestDatabase(path)
      const categories = listCategories(true).length
      expect(categories).toBeGreaterThan(0)
      saveSector({ name: 'Warehouse', description: null, active: true })

      migrate(getDb())

      expect(listCategories(true)).toHaveLength(categories)
      expect(listSectors(true).some((sector) => sector.name === 'Warehouse')).toBe(true)
      const versions = getDb().query<{ version: number }, []>('SELECT version FROM schema_migrations').all()
      expect(versions.map((row) => row.version)).toEqual([1, 2, 3])
    } finally {
      closeDb()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
