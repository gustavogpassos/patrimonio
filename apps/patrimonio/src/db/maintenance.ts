import { isBefore, isFutureDate } from '@/lib/dates'
import type {
  CancelMaintenanceInput,
  CompleteMaintenanceInput,
  OpenMaintenanceInput,
} from '@/lib/schemas'
import type {
  EquipmentStatus,
  Maintenance,
  MaintenanceState,
  MaintenanceType,
  Paginated,
} from '@/lib/types'
import { AppError, wrapDb } from './errors'
import { getEquipment } from './equipment'
import { getDb, nullIfEmpty } from './sqlite'

type Row = {
  id: number
  equipment_id: number
  equipment_name: string
  equipment_asset_tag: string
  type: MaintenanceType
  state: MaintenanceState
  opened_on: string
  completed_on: string | null
  problem: string
  solution: string | null
  cost_cents: number | null
  service_provider: string | null
  cancellation_reason: string | null
  previous_status: EquipmentStatus
  equipment_status_after: 'in_use' | 'in_stock' | 'written_off' | null
  created_at: string
  updated_at: string
}

function mapRow(row: Row): Maintenance {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    equipmentName: row.equipment_name,
    equipmentAssetTag: row.equipment_asset_tag,
    type: row.type,
    state: row.state,
    openedOn: row.opened_on,
    completedOn: row.completed_on,
    problem: row.problem,
    solution: row.solution,
    costCents: row.cost_cents,
    serviceProvider: row.service_provider,
    cancellationReason: row.cancellation_reason,
    previousStatus: row.previous_status,
    equipmentStatusAfter: row.equipment_status_after,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type ListMaintenanceParams = {
  state?: MaintenanceState
  type?: MaintenanceType
  equipmentId?: number
  q?: string
  page?: number
  pageSize?: number
}

export function listMaintenance(
  params: ListMaintenanceParams = {},
): Paginated<Maintenance> {
  return wrapDb(() => {
    const db = getDb()
    const page = Math.max(1, params.page ?? 1)
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 10_000)
    const offset = (page - 1) * pageSize

    const where: string[] = []
    const args: Array<string | number> = []

    if (params.state) {
      where.push('m.state = ?')
      args.push(params.state)
    }
    if (params.type) {
      where.push('m.type = ?')
      args.push(params.type)
    }
    if (params.equipmentId) {
      where.push('m.equipment_id = ?')
      args.push(params.equipmentId)
    }
    if (params.q?.trim()) {
      const like = `%${params.q.trim().toLowerCase()}%`
      where.push('(lower(e.name) LIKE ? OR lower(e.asset_tag) LIKE ?)')
      args.push(like, like)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total =
      db
        .query<{ c: number }, Array<string | number>>(
          `SELECT COUNT(*) AS c
           FROM maintenance m
           JOIN equipment e ON e.id = m.equipment_id
           ${whereSql}`,
        )
        .get(...args)?.c ?? 0

    const rows = db
      .query<Row, Array<string | number>>(
        `SELECT m.*,
          e.name AS equipment_name,
          e.asset_tag AS equipment_asset_tag
         FROM maintenance m
         JOIN equipment e ON e.id = m.equipment_id
         ${whereSql}
         ORDER BY m.opened_on DESC, m.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, offset)

    return { items: rows.map(mapRow), total }
  })
}

function getMaintenance(id: number): Maintenance {
  const db = getDb()
  const row = db
    .query<Row, [number]>(
      `SELECT m.*,
        e.name AS equipment_name,
        e.asset_tag AS equipment_asset_tag
       FROM maintenance m
       JOIN equipment e ON e.id = m.equipment_id
       WHERE m.id = ?`,
    )
    .get(id)
  if (!row) throw new AppError('Manutenção não encontrada.')
  return mapRow(row)
}

export function openMaintenance(input: OpenMaintenanceInput): Maintenance {
  return wrapDb(() => {
    const db = getDb()
    const equipment = getEquipment(input.equipmentId)
    if (equipment.status === 'written_off') {
      throw new AppError('Equipamento baixado não pode abrir manutenção.')
    }
    if (equipment.hasOpenMaintenance) {
      throw new AppError('Este equipamento já possui uma manutenção aberta.')
    }
    if (isFutureDate(input.openedOn)) {
      throw new AppError('Data de abertura não pode ser futura.')
    }

    const tx = db.transaction(() => {
      const result = db
        .query(
          `INSERT INTO maintenance (
            equipment_id, type, state, opened_on, problem,
            cost_cents, service_provider, previous_status,
            created_at, updated_at
          ) VALUES (?, ?, 'open', ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
        )
        .run(
          input.equipmentId,
          input.type,
          input.openedOn,
          input.problem.trim(),
          input.costCents ?? null,
          nullIfEmpty(input.serviceProvider),
          equipment.status,
        )
      db.query(
        `UPDATE equipment
         SET status = 'in_maintenance', updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(input.equipmentId)
      return Number(result.lastInsertRowid)
    })

    return getMaintenance(tx())
  })
}

export function completeMaintenance(
  id: number,
  input: CompleteMaintenanceInput,
): Maintenance {
  return wrapDb(() => {
    const db = getDb()
    const record = getMaintenance(id)
    if (record.state !== 'open') {
      throw new AppError('Somente manutenções abertas podem ser concluídas.')
    }
    if (isFutureDate(input.completedOn)) {
      throw new AppError('Data de conclusão não pode ser futura.')
    }
    if (isBefore(input.completedOn, record.openedOn)) {
      throw new AppError('Conclusão não pode ser anterior à abertura.')
    }

    let writeOffReason: string | null = null
    if (input.equipmentStatusAfter === 'written_off') {
      const reason = (input.writeOffReason ?? '').trim()
      if (reason.length < 3) {
        throw new AppError('Informe o motivo da baixa (mínimo 3 caracteres).')
      }
      writeOffReason = reason
    }

    const tx = db.transaction(() => {
      db.query(
        `UPDATE maintenance SET
          state = 'completed',
          completed_on = ?,
          solution = ?,
          cost_cents = ?,
          service_provider = ?,
          equipment_status_after = ?,
          updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(
        input.completedOn,
        input.solution.trim(),
        input.costCents ?? null,
        nullIfEmpty(input.serviceProvider),
        input.equipmentStatusAfter,
        id,
      )

      if (input.equipmentStatusAfter === 'written_off') {
        db.query(
          `UPDATE equipment SET
            status = 'written_off',
            write_off_reason = ?,
            written_off_on = ?,
            updated_at = datetime('now','localtime')
           WHERE id = ?`,
        ).run(writeOffReason, input.completedOn, record.equipmentId)
      } else {
        db.query(
          `UPDATE equipment SET
            status = ?,
            updated_at = datetime('now','localtime')
           WHERE id = ?`,
        ).run(input.equipmentStatusAfter, record.equipmentId)
      }
    })
    tx()
    return getMaintenance(id)
  })
}

export function cancelMaintenance(
  id: number,
  input: CancelMaintenanceInput,
): Maintenance {
  return wrapDb(() => {
    const db = getDb()
    const record = getMaintenance(id)
    if (record.state !== 'open') {
      throw new AppError('Somente manutenções abertas podem ser canceladas.')
    }

    const restoredStatus =
      record.previousStatus === 'in_maintenance' ? 'in_use' : record.previousStatus

    const tx = db.transaction(() => {
      db.query(
        `UPDATE maintenance SET
          state = 'cancelled',
          cancellation_reason = ?,
          updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(input.cancellationReason.trim(), id)
      db.query(
        `UPDATE equipment SET
          status = ?,
          updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(restoredStatus, record.equipmentId)
    })
    tx()
    return getMaintenance(id)
  })
}
