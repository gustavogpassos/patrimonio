import type { SectorInput } from '@/lib/schemas'
import type { Sector } from '@/lib/types'
import { AppError, wrapDb } from './errors'
import { all, get, run } from './sql'
import { nullIfEmpty } from './sqlite'

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
    id: Number(row.id),
    name: row.name,
    description: row.description,
    active: Number(row.active) === 1,
    equipmentCount: Number(row.equipment_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listSectors(includeInactive = false): Promise<Sector[]> {
  return wrapDb(async () => {
    const rows = await all<Row>(
      `SELECT s.*,
        (SELECT COUNT(*) FROM equipment e WHERE e.sector_id = s.id) AS equipment_count
       FROM sectors s
       WHERE (? = 1 OR s.active = 1)
       ORDER BY s.name COLLATE NOCASE`,
      includeInactive ? 1 : 0,
    )
    return rows.map(mapRow)
  })
}

export async function saveSector(input: SectorInput & { id?: number }): Promise<Sector> {
  return wrapDb(async () => {
    const name = input.name.trim()
    const description = nullIfEmpty(input.description)
    const active = input.active ? 1 : 0

    if (input.id) {
      await run(
        `UPDATE sectors
         SET name = ?, description = ?, active = ?, updated_at = datetime('now','localtime')
         WHERE id = ?`,
        name,
        description,
        active,
        input.id,
      )
      return getSector(input.id)
    }

    const result = await run(
      `INSERT INTO sectors (name, description, active, created_at, updated_at)
       VALUES (?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
      name,
      description,
      active,
    )
    return getSector(Number(result.lastInsertRowid))
  })
}

export async function getSector(id: number): Promise<Sector> {
  return wrapDb(async () => {
    const row = await get<Row>(
      `SELECT s.*,
        (SELECT COUNT(*) FROM equipment e WHERE e.sector_id = s.id) AS equipment_count
       FROM sectors s WHERE s.id = ?`,
      id,
    )
    if (!row) throw new AppError('Setor não encontrado.')
    return mapRow(row)
  })
}

export async function deleteSector(id: number): Promise<void> {
  return wrapDb(async () => {
    const count =
      (
        await get<{ c: number }>(
          'SELECT COUNT(*) AS c FROM equipment WHERE sector_id = ?',
          id,
        )
      )?.c ?? 0
    if (Number(count) > 0) {
      throw new AppError(
        'Não é possível excluir: há equipamentos neste setor. Inative o setor.',
      )
    }
    const result = await run('DELETE FROM sectors WHERE id = ?', id)
    if (result.changes === 0) throw new AppError('Setor não encontrado.')
  })
}
