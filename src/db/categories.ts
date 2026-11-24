import type { CategoryInput } from '@/lib/schemas'
import type { Category } from '@/lib/types'
import { AppError, wrapDb } from './errors'
import { getDb, nullIfEmpty } from './sqlite'

type Row = {
  id: number
  name: string
  description: string | null
  active: number
  regular_maintenance: number
  maintenance_interval_days: number | null
  equipment_count: number
  created_at: string
  updated_at: string
}

function mapRow(row: Row): Category {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    active: row.active === 1,
    regularMaintenance: row.regular_maintenance === 1,
    maintenanceIntervalDays: row.maintenance_interval_days,
    equipmentCount: row.equipment_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listCategories(includeInactive = false): Category[] {
  return wrapDb(() => {
    const db = getDb()
    const rows = db
      .query<Row, [number]>(
        `SELECT c.*,
          (SELECT COUNT(*) FROM equipment e WHERE e.category_id = c.id) AS equipment_count
         FROM categories c
         WHERE (? = 1 OR c.active = 1)
         ORDER BY c.name COLLATE NOCASE`,
      )
      .all(includeInactive ? 1 : 0)
    return rows.map(mapRow)
  })
}

export function saveCategory(input: CategoryInput & { id?: number }): Category {
  return wrapDb(() => {
    const db = getDb()
    const name = input.name.trim()
    const description = nullIfEmpty(input.description)
    const active = input.active ? 1 : 0
    const regularMaintenance = input.regularMaintenance ? 1 : 0
    const interval = categoryInterval(input)

    if (input.id) {
      db.query(
        `UPDATE categories
         SET name = ?, description = ?, active = ?,
             regular_maintenance = ?, maintenance_interval_days = ?,
             updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(name, description, active, regularMaintenance, interval, input.id)
      return getCategory(input.id)
    }

    const result = db
      .query(
        `INSERT INTO categories (
           name, description, active, regular_maintenance, maintenance_interval_days,
           created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
      )
      .run(name, description, active, regularMaintenance, interval)
    return getCategory(Number(result.lastInsertRowid))
  })
}

function categoryInterval(input: CategoryInput): number | null {
  if (!input.regularMaintenance) return null
  const days = input.maintenanceIntervalDays
  if (days == null || !Number.isInteger(days) || days < 1 || days > 3650) {
    throw new AppError('Informe a frequência da manutenção regular, em dias.')
  }
  return days
}

export function getCategory(id: number): Category {
  return wrapDb(() => {
    const db = getDb()
    const row = db
      .query<Row, [number]>(
        `SELECT c.*,
          (SELECT COUNT(*) FROM equipment e WHERE e.category_id = c.id) AS equipment_count
         FROM categories c WHERE c.id = ?`,
      )
      .get(id)
    if (!row) throw new AppError('Categoria não encontrada.')
    return mapRow(row)
  })
}

export function deleteCategory(id: number) {
  return wrapDb(() => {
    const db = getDb()
    const count = db
      .query<{ c: number }, [number]>(
        'SELECT COUNT(*) AS c FROM equipment WHERE category_id = ?',
      )
      .get(id)?.c ?? 0
    if (count > 0) {
      throw new AppError(
        'Não é possível excluir: há equipamentos nesta categoria. Inative a categoria.',
      )
    }
    const result = db.query('DELETE FROM categories WHERE id = ?').run(id)
    if (result.changes === 0) throw new AppError('Categoria não encontrada.')
  })
}
