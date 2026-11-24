import type { SectorInput } from '@/lib/schemas'
import type { Sector } from '@/lib/types'
import { AppError, wrapDb } from './errors'
import { getDb, nullIfEmpty } from './sqlite'

type Row = {
  id: number
  name: string
  description: string | null
  active: number
  equipment_count: number
  created_at: string
  updated_at: string
}

function mapRow(row: Row): Sector {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active === 1,
    equipmentCount: row.equipment_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listSectors(includeInactive = false): Sector[] {
  return wrapDb(() => {
    const db = getDb()
    const rows = db
      .query<Row, [number]>(
        `SELECT s.*,
          (SELECT COUNT(*) FROM equipment e WHERE e.sector_id = s.id) AS equipment_count
         FROM sectors s
         WHERE (? = 1 OR s.active = 1)
         ORDER BY s.name COLLATE NOCASE`,
      )
      .all(includeInactive ? 1 : 0)
    return rows.map(mapRow)
  })
}

export function saveSector(input: SectorInput & { id?: number }): Sector {
  return wrapDb(() => {
    const db = getDb()
    const name = input.name.trim()
    const description = nullIfEmpty(input.description)
    const active = input.active ? 1 : 0

    if (input.id) {
      db.query(
        `UPDATE sectors
         SET name = ?, description = ?, active = ?, updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(name, description, active, input.id)
      return getSector(input.id)
    }

    const result = db
      .query(
        `INSERT INTO sectors (name, description, active, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
      )
      .run(name, description, active)
    return getSector(Number(result.lastInsertRowid))
  })
}

export function getSector(id: number): Sector {
  return wrapDb(() => {
    const db = getDb()
    const row = db
      .query<Row, [number]>(
        `SELECT s.*,
          (SELECT COUNT(*) FROM equipment e WHERE e.sector_id = s.id) AS equipment_count
         FROM sectors s WHERE s.id = ?`,
      )
      .get(id)
    if (!row) throw new AppError('Setor não encontrado.')
    return mapRow(row)
  })
}

export function deleteSector(id: number) {
  return wrapDb(() => {
    const db = getDb()
    const count = db
      .query<{ c: number }, [number]>(
        'SELECT COUNT(*) AS c FROM equipment WHERE sector_id = ?',
      )
      .get(id)?.c ?? 0
    if (count > 0) {
      throw new AppError(
        'Não é possível excluir: há equipamentos neste setor. Inative o setor.',
      )
    }
    const result = db.query('DELETE FROM sectors WHERE id = ?').run(id)
    if (result.changes === 0) throw new AppError('Setor não encontrado.')
  })
}
