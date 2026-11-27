import { addDays, todayLocal } from '@/lib/dates'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { saveCategory } from './categories'
import { dashboard } from './dashboard'
import { createEquipment, writeOffEquipment } from './equipment'
import { completeMaintenance, openMaintenance } from './maintenance'
import { saveSector } from './sectors'
import { run } from './sql'
import { closeDb, useTestDatabase } from './sqlite'

const dir = join(process.cwd(), 'data', 'test-tmp')

async function setup() {
  mkdirSync(dir, { recursive: true })
  useTestDatabase(join(dir, `mr-${Date.now()}-${Math.random()}.db`))
  const sector = await saveSector({ name: 'IT', description: null, active: true })
  return { sector }
}

async function equipment(categoryId: number, sectorId: number, assetTag: string) {
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

async function backdate(id: number, isoDate: string) {
  await run('UPDATE equipment SET created_at = ? WHERE id = ?', `${isoDate} 08:00:00`, id)
}

afterEach(() => {
  closeDb()
})

describe('regular maintenance', () => {
  test('category stores the interval and requires days when the check is on', async () => {
    const { sector } = await setup()
    expect(sector.id).toBeGreaterThan(0)
    const category = await saveCategory({
      name: 'UPS test',
      description: null,
      active: true,
      regularMaintenance: true,
      maintenanceIntervalDays: 30,
    })
    expect(category.regularMaintenance).toBe(true)
    expect(category.maintenanceIntervalDays).toBe(30)

    const off = await saveCategory({
      id: category.id,
      name: category.name,
      description: null,
      active: true,
      regularMaintenance: false,
      maintenanceIntervalDays: 30,
    })
    expect(off.regularMaintenance).toBe(false)
    expect(off.maintenanceIntervalDays).toBeNull()

    await expect(
      saveCategory({
        name: 'No days',
        description: null,
        active: true,
        regularMaintenance: true,
        maintenanceIntervalDays: null,
      }),
    ).rejects.toThrow(/frequência/)
  })

  test('the warning counts from registration and completion restarts the deadline', async () => {
    const { sector } = await setup()
    const today = todayLocal()
    const category = await saveCategory({
      name: 'UPS test',
      description: null,
      active: true,
      regularMaintenance: true,
      maintenanceIntervalDays: 30,
    })

    const overdue = await equipment(category.id, sector.id, 'PAT-000001')
    await backdate(overdue.id, addDays(today, -30))

    const onTime = await equipment(category.id, sector.id, 'PAT-000002')
    await backdate(onTime.id, addDays(today, -10))

    const restarted = await equipment(category.id, sector.id, 'PAT-000003')
    await backdate(restarted.id, addDays(today, -90))
    const done = await openMaintenance({
      equipmentId: restarted.id,
      type: 'preventive',
      openedOn: addDays(today, -5),
      problem: 'Periodic service',
      costCents: null,
      serviceProvider: null,
    })
    await completeMaintenance(done.id, {
      completedOn: addDays(today, -5),
      solution: 'Service done',
      costCents: null,
      serviceProvider: null,
      equipmentStatusAfter: 'in_use',
      writeOffReason: null,
    })

    const open = await equipment(category.id, sector.id, 'PAT-000004')
    await backdate(open.id, addDays(today, -40))
    await openMaintenance({
      equipmentId: open.id,
      type: 'corrective',
      openedOn: addDays(today, -1),
      problem: 'Will not start',
      costCents: null,
      serviceProvider: null,
    })

    const noRoutine = await saveCategory({
      name: 'Monitor test',
      description: null,
      active: true,
      regularMaintenance: false,
      maintenanceIntervalDays: null,
    })
    await backdate((await equipment(noRoutine.id, sector.id, 'PAT-000005')).id, addDays(today, -400))

    const writtenOff = await equipment(category.id, sector.id, 'PAT-000006')
    await backdate(writtenOff.id, addDays(today, -400))
    await writeOffEquipment(writtenOff.id, { writtenOffOn: today, writeOffReason: 'Beyond repair' })

    expect((await dashboard()).overdueRegularMaintenance.map((item) => item.assetTag)).toEqual([
      'PAT-000004',
      'PAT-000001',
    ])
  })
})
