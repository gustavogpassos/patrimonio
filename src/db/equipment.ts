import { isBefore, isFutureDate, todayLocal } from '@/lib/dates'
import type {
  CreateEquipmentInput,
  TransferInput,
  UpdateEquipmentInput,
  WriteOffInput,
} from '@/lib/schemas'
import type {
  EquipmentDetail,
  EquipmentListItem,
  EquipmentStatus,
  Maintenance,
  Paginated,
  Transfer,
} from '@/lib/types'
import { AppError, wrapDb } from './errors'
import { getDb, nullIfEmpty } from './sqlite'

type EquipRow = {
  id: number
  asset_tag: string
  name: string
  description: string | null
  category_id: number
  category_name: string
  category_active: number
  category_regular_maintenance: number
  category_maintenance_interval_days: number | null
  last_maintenance_completed_at: string | null
  sector_id: number
  sector_name: string
  sector_active: number
  location: string | null
  brand: string | null
  model: string | null
  serial_number: string | null
  status: EquipmentStatus
  acquired_on: string | null
  acquisition_value_cents: number | null
  supplier: string | null
  invoice: string | null
  warranty_until: string | null
  notes: string | null
  write_off_reason: string | null
  written_off_on: string | null
  created_at: string
  updated_at: string
}

export const EQUIPMENT_SELECT = `
  SELECT e.*,
    c.name AS category_name,
    c.active AS category_active,
    c.regular_maintenance AS category_regular_maintenance,
    c.maintenance_interval_days AS category_maintenance_interval_days,
    (
      SELECT MAX(m.completed_on)
      FROM maintenance m
      WHERE m.equipment_id = e.id AND m.state = 'completed'
    ) AS last_maintenance_completed_at,
    s.name AS sector_name,
    s.active AS sector_active
  FROM equipment e
  JOIN categories c ON c.id = e.category_id
  JOIN sectors s ON s.id = e.sector_id
`

export function mapEquipment(row: EquipRow): EquipmentListItem {
  return {
    id: row.id,
    assetTag: row.asset_tag,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryActive: row.category_active === 1,
    categoryRegularMaintenance: row.category_regular_maintenance === 1,
    categoryMaintenanceIntervalDays: row.category_maintenance_interval_days,
    lastMaintenanceCompletedAt: row.last_maintenance_completed_at,
    sectorId: row.sector_id,
    sectorName: row.sector_name,
    sectorActive: row.sector_active === 1,
    location: row.location,
    brand: row.brand,
    model: row.model,
    serialNumber: row.serial_number,
    status: row.status,
    acquiredOn: row.acquired_on,
    acquisitionValueCents: row.acquisition_value_cents,
    supplier: row.supplier,
    invoice: row.invoice,
    warrantyUntil: row.warranty_until,
    notes: row.notes,
    writeOffReason: row.write_off_reason,
    writtenOffOn: row.written_off_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function assertNotFuture(date: string, label: string) {
  if (isFutureDate(date)) {
    throw new AppError(`${label} cannot be in the future.`)
  }
}

export function nextAssetTag(): string {
  return wrapDb(() => {
    const db = getDb()
    const rows = db
      .query<{ asset_tag: string }, []>(
        `SELECT asset_tag FROM equipment
         WHERE asset_tag GLOB 'PAT-[0-9]*'`,
      )
      .all()
    let max = 0
    for (const row of rows) {
      const match = /^PAT-(\d+)$/i.exec(row.asset_tag)
      if (match) max = Math.max(max, Number(match[1]))
    }
    return `PAT-${String(max + 1).padStart(6, '0')}`
  })
}

export type ListEquipmentParams = {
  q?: string
  categoryId?: number
  sectorId?: number
  status?: EquipmentStatus
  sort?: 'assetTag' | 'name' | 'status'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export function listEquipment(
  params: ListEquipmentParams = {},
): Paginated<EquipmentListItem> {
  return wrapDb(() => {
    const db = getDb()
    const page = Math.max(1, params.page ?? 1)
    let pageSize = params.pageSize ?? 20
    if (pageSize === 0) pageSize = 10_000
    pageSize = Math.min(Math.max(pageSize, 1), 10_000)
    const offset = (page - 1) * pageSize

    const where: string[] = []
    const args: Array<string | number> = []

    if (params.q?.trim()) {
      const like = `%${params.q.trim().toLowerCase()}%`
      where.push(`(
        lower(e.asset_tag) LIKE ? OR lower(e.name) LIKE ? OR
        lower(ifnull(e.serial_number,'')) LIKE ? OR lower(ifnull(e.brand,'')) LIKE ? OR
        lower(ifnull(e.model,'')) LIKE ? OR lower(ifnull(e.description,'')) LIKE ?
      )`)
      args.push(like, like, like, like, like, like)
    }
    if (params.categoryId) {
      where.push('e.category_id = ?')
      args.push(params.categoryId)
    }
    if (params.sectorId) {
      where.push('e.sector_id = ?')
      args.push(params.sectorId)
    }
    if (params.status) {
      where.push('e.status = ?')
      args.push(params.status)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const sortCol =
      params.sort === 'name'
        ? 'e.name'
        : params.sort === 'status'
          ? 'e.status'
          : 'e.asset_tag'
    const sortDir = params.order === 'asc' ? 'ASC' : 'DESC'

    const total =
      db
        .query<{ c: number }, Array<string | number>>(
          `SELECT COUNT(*) AS c FROM equipment e ${whereSql}`,
        )
        .get(...args)?.c ?? 0

    const rows = db
      .query<EquipRow, Array<string | number>>(
        `${EQUIPMENT_SELECT} ${whereSql}
         ORDER BY ${sortCol} COLLATE NOCASE ${sortDir}, e.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, offset)

    return { items: rows.map(mapEquipment), total }
  })
}

function listTransfers(equipmentId: number): Transfer[] {
  const db = getDb()
  const rows = db
    .query<
      {
        id: number
        equipment_id: number
        from_sector_id: number | null
        from_sector_name: string | null
        to_sector_id: number
        to_sector_name: string
        from_location: string | null
        to_location: string | null
        reason: string
        transferred_on: string
        created_at: string
      },
      [number]
    >(
      `SELECT t.*,
        origin.name AS from_sector_name,
        destination.name AS to_sector_name
       FROM transfers t
       LEFT JOIN sectors origin ON origin.id = t.from_sector_id
       JOIN sectors destination ON destination.id = t.to_sector_id
       WHERE t.equipment_id = ?
       ORDER BY t.transferred_on DESC, t.id DESC`,
    )
    .all(equipmentId)

  return rows.map((row) => ({
    id: row.id,
    equipmentId: row.equipment_id,
    fromSectorId: row.from_sector_id,
    fromSectorName: row.from_sector_name,
    toSectorId: row.to_sector_id,
    toSectorName: row.to_sector_name,
    fromLocation: row.from_location,
    toLocation: row.to_location,
    reason: row.reason,
    transferredOn: row.transferred_on,
    createdAt: row.created_at,
  }))
}

function listEquipmentMaintenance(equipmentId: number): Maintenance[] {
  const db = getDb()
  const rows = db
    .query<
      {
        id: number
        equipment_id: number
        type: Maintenance['type']
        state: Maintenance['state']
        opened_on: string
        completed_on: string | null
        problem: string
        solution: string | null
        cost_cents: number | null
        service_provider: string | null
        cancellation_reason: string | null
        previous_status: EquipmentStatus
        equipment_status_after: Maintenance['equipmentStatusAfter']
        created_at: string
        updated_at: string
      },
      [number]
    >(
      `SELECT * FROM maintenance
       WHERE equipment_id = ?
       ORDER BY opened_on DESC, id DESC`,
    )
    .all(equipmentId)

  return rows.map((row) => ({
    id: row.id,
    equipmentId: row.equipment_id,
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
  }))
}

export function getEquipment(id: number): EquipmentDetail {
  return wrapDb(() => {
    const db = getDb()
    const row = db
      .query<EquipRow, [number]>(`${EQUIPMENT_SELECT} WHERE e.id = ?`)
      .get(id)
    if (!row) throw new AppError('Equipment not found.')
    const maintenance = listEquipmentMaintenance(id)
    return {
      ...mapEquipment(row),
      transfers: listTransfers(id),
      maintenance,
      hasOpenMaintenance: maintenance.some((item) => item.state === 'open'),
    }
  })
}

function assertActiveCategory(id: number) {
  const db = getDb()
  const row = db
    .query<{ active: number }, [number]>('SELECT active FROM categories WHERE id = ?')
    .get(id)
  if (!row) throw new AppError('Category not found.')
  if (row.active !== 1) throw new AppError('Select an active category.')
}

function assertActiveSector(id: number) {
  const db = getDb()
  const row = db
    .query<{ active: number }, [number]>('SELECT active FROM sectors WHERE id = ?')
    .get(id)
  if (!row) throw new AppError('Sector not found.')
  if (row.active !== 1) throw new AppError('Select an active sector.')
}

export function createEquipment(input: CreateEquipmentInput): EquipmentDetail {
  return wrapDb(() => {
    const db = getDb()
    if (input.status !== 'in_stock' && input.status !== 'in_use') {
      throw new AppError('Registration only accepts In stock or In use.')
    }
    assertActiveCategory(input.categoryId)
    assertActiveSector(input.sectorId)

    const transferDate =
      input.acquiredOn && input.acquiredOn.length > 0
        ? input.acquiredOn
        : todayLocal()
    assertNotFuture(transferDate, 'Acquisition date')

    const tx = db.transaction(() => {
      const result = db
        .query(
          `INSERT INTO equipment (
            asset_tag, name, description, category_id, sector_id, location,
            brand, model, serial_number, status, acquired_on, acquisition_value_cents,
            supplier, invoice, warranty_until, notes,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
        )
        .run(
          input.assetTag.trim(),
          input.name.trim(),
          nullIfEmpty(input.description),
          input.categoryId,
          input.sectorId,
          nullIfEmpty(input.location),
          nullIfEmpty(input.brand),
          nullIfEmpty(input.model),
          nullIfEmpty(input.serialNumber),
          input.status,
          nullIfEmpty(input.acquiredOn),
          input.acquisitionValueCents ?? null,
          nullIfEmpty(input.supplier),
          nullIfEmpty(input.invoice),
          nullIfEmpty(input.warrantyUntil),
          nullIfEmpty(input.notes),
        )

      const id = Number(result.lastInsertRowid)
      db.query(
        `INSERT INTO transfers (
          equipment_id, from_sector_id, to_sector_id,
          from_location, to_location, reason, transferred_on, created_at
        ) VALUES (?, NULL, ?, NULL, ?, 'Initial registration', ?, datetime('now','localtime'))`,
      ).run(id, input.sectorId, nullIfEmpty(input.location), transferDate)
      return id
    })

    const id = tx()
    return getEquipment(id)
  })
}

export function updateEquipment(
  id: number,
  input: UpdateEquipmentInput,
): EquipmentDetail {
  return wrapDb(() => {
    getEquipment(id)
    assertActiveCategory(input.categoryId)
    if (input.acquiredOn) assertNotFuture(input.acquiredOn, 'Acquisition date')

    const db = getDb()
    db.query(
      `UPDATE equipment SET
        asset_tag = ?, name = ?, description = ?, category_id = ?,
        brand = ?, model = ?, serial_number = ?,
        acquired_on = ?, acquisition_value_cents = ?,
        supplier = ?, invoice = ?, warranty_until = ?, notes = ?,
        updated_at = datetime('now','localtime')
       WHERE id = ?`,
    ).run(
      input.assetTag.trim(),
      input.name.trim(),
      nullIfEmpty(input.description),
      input.categoryId,
      nullIfEmpty(input.brand),
      nullIfEmpty(input.model),
      nullIfEmpty(input.serialNumber),
      nullIfEmpty(input.acquiredOn),
      input.acquisitionValueCents ?? null,
      nullIfEmpty(input.supplier),
      nullIfEmpty(input.invoice),
      nullIfEmpty(input.warrantyUntil),
      nullIfEmpty(input.notes),
      id,
    )
    return getEquipment(id)
  })
}

export function transferEquipment(
  id: number,
  input: TransferInput,
): EquipmentDetail {
  return wrapDb(() => {
    const db = getDb()
    const current = getEquipment(id)
    if (current.status === 'written_off') {
      throw new AppError('Written-off equipment cannot be transferred.')
    }
    assertActiveSector(input.toSectorId)
    assertNotFuture(input.transferredOn, 'Transfer date')

    const toLocation = nullIfEmpty(input.toLocation)
    const sameSector = current.sectorId === input.toSectorId
    const sameLocation = (current.location ?? null) === (toLocation ?? null)
    if (sameSector && sameLocation) {
      throw new AppError('Destination sector and location are the same as the current ones.')
    }
    if (current.acquiredOn && isBefore(input.transferredOn, current.acquiredOn)) {
      throw new AppError('Transfer date cannot be before the acquisition date.')
    }

    const tx = db.transaction(() => {
      db.query(
        `INSERT INTO transfers (
          equipment_id, from_sector_id, to_sector_id,
          from_location, to_location, reason, transferred_on, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`,
      ).run(
        id,
        current.sectorId,
        input.toSectorId,
        current.location,
        toLocation,
        input.reason.trim(),
        input.transferredOn,
      )
      db.query(
        `UPDATE equipment
         SET sector_id = ?, location = ?, updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(input.toSectorId, toLocation, id)
    })
    tx()
    return getEquipment(id)
  })
}

export function writeOffEquipment(id: number, input: WriteOffInput): EquipmentDetail {
  return wrapDb(() => {
    const db = getDb()
    const current = getEquipment(id)
    if (current.status === 'written_off') {
      throw new AppError('Equipment is already written off.')
    }
    if (current.hasOpenMaintenance) {
      throw new AppError(
        'Complete or cancel the open maintenance before writing off the equipment.',
      )
    }
    assertNotFuture(input.writtenOffOn, 'Write-off date')

    db.query(
      `UPDATE equipment
       SET status = 'written_off', write_off_reason = ?, written_off_on = ?,
           updated_at = datetime('now','localtime')
       WHERE id = ?`,
    ).run(input.writeOffReason.trim(), input.writtenOffOn, id)
    return getEquipment(id)
  })
}

export function reactivateEquipment(id: number): EquipmentDetail {
  return wrapDb(() => {
    const db = getDb()
    const current = getEquipment(id)
    if (current.status !== 'written_off') {
      throw new AppError('Only written-off equipment can be reactivated.')
    }
    db.query(
      `UPDATE equipment
       SET status = 'in_stock', write_off_reason = NULL, written_off_on = NULL,
           updated_at = datetime('now','localtime')
       WHERE id = ?`,
    ).run(id)
    return getEquipment(id)
  })
}

export function deleteEquipment(id: number, assetTagConfirmation: string) {
  return wrapDb(() => {
    const db = getDb()
    const current = getEquipment(id)
    if (current.assetTag.toLowerCase() !== assetTagConfirmation.trim().toLowerCase()) {
      throw new AppError('Confirmation asset tag does not match.')
    }
    db.query('DELETE FROM equipment WHERE id = ?').run(id)
  })
}
