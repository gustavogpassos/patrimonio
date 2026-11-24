import { regularMaintenanceInfo, todayLocal } from '@/lib/dates'
import type { DashboardData, EquipmentStatus, Maintenance } from '@/lib/types'
import { wrapDb } from './errors'
import { EQUIPMENT_SELECT, mapEquipment } from './equipment'
import { getDb } from './sqlite'

export function dashboard(): DashboardData {
  return wrapDb(() => {
    const db = getDb()
    const today = todayLocal()
    const in30 = (() => {
      const date = new Date(`${today}T12:00:00`)
      date.setDate(date.getDate() + 30)
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })()

    const counts = db
      .query<{
        active_count: number
        in_use: number
        in_stock: number
        in_maintenance: number
        written_off: number
        total_value: number | null
      }, []>(
        `SELECT
          SUM(CASE WHEN status <> 'written_off' THEN 1 ELSE 0 END) AS active_count,
          SUM(CASE WHEN status = 'in_use' THEN 1 ELSE 0 END) AS in_use,
          SUM(CASE WHEN status = 'in_stock' THEN 1 ELSE 0 END) AS in_stock,
          SUM(CASE WHEN status = 'in_maintenance' THEN 1 ELSE 0 END) AS in_maintenance,
          SUM(CASE WHEN status = 'written_off' THEN 1 ELSE 0 END) AS written_off,
          SUM(CASE WHEN status <> 'written_off' THEN ifnull(acquisition_value_cents, 0) ELSE 0 END) AS total_value
         FROM equipment`,
      )
      .get()

    const expiredWarranties = db
      .query<Parameters<typeof mapEquipment>[0], [string]>(
        `${EQUIPMENT_SELECT}
         WHERE e.status <> 'written_off'
           AND e.warranty_until IS NOT NULL
           AND e.warranty_until < ?
         ORDER BY e.warranty_until ASC
         LIMIT 10`,
      )
      .all(today)
      .map(mapEquipment)

    const warrantiesDueSoon = db
      .query<Parameters<typeof mapEquipment>[0], [string, string]>(
        `${EQUIPMENT_SELECT}
         WHERE e.status <> 'written_off'
           AND e.warranty_until IS NOT NULL
           AND e.warranty_until >= ?
           AND e.warranty_until <= ?
         ORDER BY e.warranty_until ASC
         LIMIT 10`,
      )
      .all(today, in30)
      .map(mapEquipment)

    const regular = db
      .query<Parameters<typeof mapEquipment>[0], []>(
        `${EQUIPMENT_SELECT}
         WHERE e.status <> 'written_off' AND c.regular_maintenance = 1`,
      )
      .all()
      .map(mapEquipment)
    const overdueRegularMaintenance = regular
      .flatMap((item) => {
        const info = regularMaintenanceInfo({
          intervalDays: item.categoryMaintenanceIntervalDays,
          registeredAt: item.createdAt,
          lastCompletedOn: item.lastMaintenanceCompletedAt,
          today,
        })
        return info.kind === 'due' ? [{ item, days: info.days }] : []
      })
      .sort((a, b) => a.days - b.days)
      .slice(0, 10)
      .map((entry) => entry.item)

    const openMaintenance = db
      .query<
        {
          id: number
          equipment_id: number
          equipment_name: string
          equipment_asset_tag: string
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
        []
      >(
        `SELECT m.*,
          e.name AS equipment_name,
          e.asset_tag AS equipment_asset_tag
         FROM maintenance m
         JOIN equipment e ON e.id = m.equipment_id
         WHERE m.state = 'open'
         ORDER BY m.opened_on DESC, m.id DESC`,
      )
      .all()
      .map((row) => ({
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
      }))

    const recentTransfers = db
      .query<
        {
          id: number
          equipment_id: number
          equipment_name: string
          equipment_asset_tag: string
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
        []
      >(
        `SELECT t.*,
          e.name AS equipment_name,
          e.asset_tag AS equipment_asset_tag,
          origin.name AS from_sector_name,
          destination.name AS to_sector_name
         FROM transfers t
         JOIN equipment e ON e.id = t.equipment_id
         LEFT JOIN sectors origin ON origin.id = t.from_sector_id
         JOIN sectors destination ON destination.id = t.to_sector_id
         ORDER BY t.transferred_on DESC, t.id DESC
         LIMIT 8`,
      )
      .all()
      .map((row) => ({
        id: row.id,
        equipmentId: row.equipment_id,
        equipmentName: row.equipment_name,
        equipmentAssetTag: row.equipment_asset_tag,
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

    return {
      activeCount: counts?.active_count ?? 0,
      inUse: counts?.in_use ?? 0,
      inStock: counts?.in_stock ?? 0,
      inMaintenance: counts?.in_maintenance ?? 0,
      writtenOff: counts?.written_off ?? 0,
      totalValueCents: counts?.total_value ?? 0,
      expiredWarranties,
      warrantiesDueSoon,
      overdueRegularMaintenance,
      openMaintenance,
      recentTransfers,
    }
  })
}
