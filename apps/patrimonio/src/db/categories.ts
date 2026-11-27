import type { CategoryInput } from '@/lib/schemas'
import type { Category } from '@/lib/types'
import { AppError, wrapDb } from './errors'
import { all, get, run } from './sql'
import { nullIfEmpty } from './sqlite'

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
    id: Number(row.id),
    name: row.name,
    description: row.description,
    active: Number(row.active) === 1,
    regularMaintenance: Number(row.regular_maintenance) === 1,
    maintenanceIntervalDays:
      row.maintenance_interval_days == null ? null : Number(row.maintenance_interval_days),
    equipmentCount: Number(row.equipment_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listCategories(includeInactive = false): Promise<Category[]> {
  return wrapDb(async () => {
    const rows = await all<Row>(
      `SELECT c.*,
        (SELECT COUNT(*) FROM equipment e WHERE e.category_id = c.id) AS equipment_count
       FROM categories c
       WHERE (? = 1 OR c.active = 1)
       ORDER BY c.name COLLATE NOCASE`,
      includeInactive ? 1 : 0,
    )
    return rows.map(mapRow)
  })
}

export async function saveCategory(input: CategoryInput & { id?: number }): Promise<Category> {
  return wrapDb(async () => {
    const name = input.name.trim()
    const description = nullIfEmpty(input.description)
    const active = input.active ? 1 : 0
    const regularMaintenance = input.regularMaintenance ? 1 : 0
    const interval = categoryInterval(input)

    if (input.id) {
      await run(
        `UPDATE categories
         SET name = ?, description = ?, active = ?,
             regular_maintenance = ?, maintenance_interval_days = ?,
             updated_at = datetime('now','localtime')
         WHERE id = ?`,
        name,
        description,
        active,
        regularMaintenance,
        interval,
        input.id,
      )
      return getCategory(input.id)
    }

    const result = await run(
      `INSERT INTO categories (
         name, description, active, regular_maintenance, maintenance_interval_days,
         created_at, updated_at
       )
       VALUES (?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
      name,
      description,
      active,
      regularMaintenance,
      interval,
    )
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

export async function getCategory(id: number): Promise<Category> {
  return wrapDb(async () => {
    const row = await get<Row>(
      `SELECT c.*,
        (SELECT COUNT(*) FROM equipment e WHERE e.category_id = c.id) AS equipment_count
       FROM categories c WHERE c.id = ?`,
      id,
    )
    if (!row) throw new AppError('Categoria não encontrada.')
    return mapRow(row)
  })
}

export async function deleteCategory(id: number): Promise<void> {
  return wrapDb(async () => {
    const count =
      (
        await get<{ c: number }>(
          'SELECT COUNT(*) AS c FROM equipment WHERE category_id = ?',
          id,
        )
      )?.c ?? 0
    if (Number(count) > 0) {
      throw new AppError(
        'Não é possível excluir: há equipamentos nesta categoria. Inative a categoria.',
      )
    }
    const result = await run('DELETE FROM categories WHERE id = ?', id)
    if (result.changes === 0) throw new AppError('Categoria não encontrada.')
  })
}
