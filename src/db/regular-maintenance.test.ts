import { addDays, todayLocal } from '@/lib/dates'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { saveCategory } from './categories'
import { dashboard } from './dashboard'
import { createEquipment, writeOffEquipment } from './equipment'
import { completeMaintenance, openMaintenance } from './maintenance'
import { saveSector } from './sectors'
import { closeDb, getDb, useTestDatabase } from './sqlite'

const dir = join(process.cwd(), 'data', 'test-tmp')

function setup() {
  mkdirSync(dir, { recursive: true })
  useTestDatabase(join(dir, `mr-${Date.now()}-${Math.random()}.db`))
  const sector = saveSector({ name: 'IT', description: null, active: true })
  return { sector }
}

function equipment(categoryId: number, sectorId: number, assetTag: string) {
  return createEquipment({
    assetTag,
    name: assetTag,
    description: null,
    categoryId,
    sectorId,
    location: null,
    status: 'in_use',
    brand: null,
    model: null,
    serialNumber: null,
    acquiredOn: null,
    acquisitionValueCents: null,
    supplier: null,
    invoice: null,
    warrantyUntil: null,
    notes: null,
  })
}

function backdate(id: number, isoDate: string) {
  getDb()
    .query('UPDATE equipment SET created_at = ? WHERE id = ?')
    .run(`${isoDate} 08:00:00`, id)
}

afterEach(() => {
  closeDb()
})

describe('regular maintenance', () => {
  test('category stores the interval and requires days when the check is on', () => {
    const { sector } = setup()
    expect(sector.id).toBeGreaterThan(0)
    const category = saveCategory({
      name: 'UPS test',
      description: null,
      active: true,
      regularMaintenance: true,
      maintenanceIntervalDays: 30,
    })
    expect(category.regularMaintenance).toBe(true)
    expect(category.maintenanceIntervalDays).toBe(30)

    const off = saveCategory({
      id: category.id,
      name: category.name,
      description: null,
      active: true,
      regularMaintenance: false,
      maintenanceIntervalDays: 30,
    })
    expect(off.regularMaintenance).toBe(false)
    expect(off.maintenanceIntervalDays).toBeNull()

    expect(() =>
      saveCategory({
        name: 'No days',
        description: null,
        active: true,
        regularMaintenance: true,
        maintenanceIntervalDays: null,
      }),
    ).toThrow(/interval/)
  })

  test('the warning counts from registration and completion restarts the deadline', () => {
    const { sector } = setup()
    const today = todayLocal()
    const category = saveCategory({
      name: 'UPS test',
      description: null,
      active: true,
      regularMaintenance: true,
      maintenanceIntervalDays: 30,
    })

    const overdue = equipment(category.id, sector.id, 'PAT-000001')
    backdate(overdue.id, addDays(today, -30))

    const onTime = equipment(category.id, sector.id, 'PAT-000002')
    backdate(onTime.id, addDays(today, -10))

    const restarted = equipment(category.id, sector.id, 'PAT-000003')
    backdate(restarted.id, addDays(today, -90))
    const done = openMaintenance({
      equipmentId: restarted.id,
      type: 'preventive',
      openedOn: addDays(today, -5),
      problem: 'Periodic service',
      costCents: null,
      serviceProvider: null,
    })
    completeMaintenance(done.id, {
      completedOn: addDays(today, -5),
      solution: 'Service done',
      costCents: null,
      serviceProvider: null,
      equipmentStatusAfter: 'in_use',
      writeOffReason: null,
    })

    const open = equipment(category.id, sector.id, 'PAT-000004')
    backdate(open.id, addDays(today, -40))
    openMaintenance({
      equipmentId: open.id,
      type: 'corrective',
      openedOn: addDays(today, -1),
      problem: 'Will not start',
      costCents: null,
      serviceProvider: null,
    })

    const noRoutine = saveCategory({
      name: 'Monitor test',
      description: null,
      active: true,
      regularMaintenance: false,
      maintenanceIntervalDays: null,
    })
    backdate(equipment(noRoutine.id, sector.id, 'PAT-000005').id, addDays(today, -400))

    const writtenOff = equipment(category.id, sector.id, 'PAT-000006')
    backdate(writtenOff.id, addDays(today, -400))
    writeOffEquipment(writtenOff.id, { writtenOffOn: today, writeOffReason: 'Beyond repair' })

    expect(dashboard().overdueRegularMaintenance.map((item) => item.assetTag)).toEqual([
      'PAT-000004',
      'PAT-000001',
    ])
  })
})
