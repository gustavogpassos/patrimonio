import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { listCategories } from './categories'
import {
  createEquipment,
  getEquipment,
  nextAssetTag,
  transferEquipment,
} from './equipment'
import { AppError } from './errors'
import {
  cancelMaintenance,
  completeMaintenance,
  openMaintenance,
} from './maintenance'
import { deleteSector, saveSector } from './sectors'
import { closeDb, useTestDatabase } from './sqlite'

const dir = join(process.cwd(), 'data', 'test-tmp')

function setup() {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `t-${Date.now()}-${Math.random()}.db`)
  useTestDatabase(path)
  const category = listCategories(true)[0]!
  const sectorA = saveSector({ name: 'IT', description: null, active: true })
  const sectorB = saveSector({ name: 'Finance', description: null, active: true })
  return { category, sectorA, sectorB }
}

afterEach(() => {
  closeDb()
})

describe('equipment rules', () => {
  test('next asset tag', () => {
    const { category, sectorA } = setup()
    expect(nextAssetTag()).toBe('PAT-000001')
    createEquipment({
      assetTag: 'PAT-000001',
      name: 'PC 1',
      description: null,
      categoryId: category.id,
      sectorId: sectorA.id,
      location: null,
      status: 'in_stock',
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
    expect(nextAssetTag()).toBe('PAT-000002')
  })

  test('duplicate asset tag', () => {
    const { category, sectorA } = setup()
    const base = {
      assetTag: 'PAT-000001',
      name: 'PC 1',
      description: null as string | null,
      categoryId: category.id,
      sectorId: sectorA.id,
      location: null as string | null,
      status: 'in_stock' as const,
      brand: null as string | null,
      model: null as string | null,
      serialNumber: null as string | null,
      acquiredOn: null as string | null,
      acquisitionValueCents: null as number | null,
      supplier: null as string | null,
      invoice: null as string | null,
      warrantyUntil: null as string | null,
      notes: null as string | null,
    }
    createEquipment(base)
    expect(() => createEquipment({ ...base, name: 'PC 2' })).toThrow(
      'Já existe um equipamento com este tombamento.',
    )
  })

  test('duplicate serial number', () => {
    const { category, sectorA } = setup()
    const base = {
      assetTag: 'PAT-000001',
      name: 'PC 1',
      description: null as string | null,
      categoryId: category.id,
      sectorId: sectorA.id,
      location: null as string | null,
      status: 'in_stock' as const,
      brand: null as string | null,
      model: null as string | null,
      serialNumber: 'SN-1',
      acquiredOn: null as string | null,
      acquisitionValueCents: null as number | null,
      supplier: null as string | null,
      invoice: null as string | null,
      warrantyUntil: null as string | null,
      notes: null as string | null,
    }
    createEquipment(base)
    expect(() =>
      createEquipment({ ...base, assetTag: 'PAT-000002', name: 'PC 2' }),
    ).toThrow('Já existe um equipamento com este número de série.')
  })

  test('cannot delete an occupied sector', () => {
    const { category, sectorA } = setup()
    createEquipment({
      assetTag: 'PAT-000001',
      name: 'PC 1',
      description: null,
      categoryId: category.id,
      sectorId: sectorA.id,
      location: null,
      status: 'in_stock',
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
    expect(() => deleteSector(sectorA.id)).toThrow(/Inative o setor/)
  })

  test('transfer and same destination', () => {
    const { category, sectorA, sectorB } = setup()
    const created = createEquipment({
      assetTag: 'PAT-000001',
      name: 'PC 1',
      description: null,
      categoryId: category.id,
      sectorId: sectorA.id,
      location: 'Room 1',
      status: 'in_use',
      brand: null,
      model: null,
      serialNumber: null,
      acquiredOn: '2024-01-01',
      acquisitionValueCents: null,
      supplier: null,
      invoice: null,
      warrantyUntil: null,
      notes: null,
    })
    expect(() =>
      transferEquipment(created.id, {
        toSectorId: sectorA.id,
        toLocation: 'Room 1',
        transferredOn: '2024-02-01',
        reason: 'Same place',
      }),
    ).toThrow('Setor e localização de destino são iguais aos atuais.')

    const moved = transferEquipment(created.id, {
      toSectorId: sectorB.id,
      toLocation: 'Room 2',
      transferredOn: '2024-02-01',
      reason: 'Sector change',
    })
    expect(moved.sectorId).toBe(sectorB.id)
    expect(moved.transfers.length).toBe(2)
  })

  test('only one open maintenance and cancellation', () => {
    const { category, sectorA } = setup()
    const created = createEquipment({
      assetTag: 'PAT-000001',
      name: 'PC 1',
      description: null,
      categoryId: category.id,
      sectorId: sectorA.id,
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
    const record = openMaintenance({
      equipmentId: created.id,
      type: 'corrective',
      openedOn: '2026-11-01',
      problem: 'Will not start',
      costCents: null,
      serviceProvider: null,
    })
    expect(getEquipment(created.id).status).toBe('in_maintenance')
    expect(() =>
      openMaintenance({
        equipmentId: created.id,
        type: 'preventive',
        openedOn: '2026-11-02',
        problem: 'Another',
        costCents: null,
        serviceProvider: null,
      }),
    ).toThrow()

    cancelMaintenance(record.id, { cancellationReason: 'False alarm' })
    expect(getEquipment(created.id).status).toBe('in_use')
  })

  test('completion with write-off', () => {
    const { category, sectorA } = setup()
    const created = createEquipment({
      assetTag: 'PAT-000001',
      name: 'PC 1',
      description: null,
      categoryId: category.id,
      sectorId: sectorA.id,
      location: null,
      status: 'in_stock',
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
    const record = openMaintenance({
      equipmentId: created.id,
      type: 'corrective',
      openedOn: '2026-11-01',
      problem: 'Burned out',
      costCents: null,
      serviceProvider: null,
    })
    completeMaintenance(record.id, {
      completedOn: '2026-11-02',
      solution: 'Beyond repair',
      costCents: null,
      serviceProvider: null,
      equipmentStatusAfter: 'written_off',
      writeOffReason: 'Scrap',
    })
    const after = getEquipment(created.id)
    expect(after.status).toBe('written_off')
    expect(after.writeOffReason).toBe('Scrap')
  })

  test('registration rejects written-off status', () => {
    const { category, sectorA } = setup()
    expect(() =>
      createEquipment({
        assetTag: 'PAT-000001',
        name: 'PC 1',
        description: null,
        categoryId: category.id,
        sectorId: sectorA.id,
        location: null,
        // @ts-expect-error invalid status on create
        status: 'written_off',
        brand: null,
        model: null,
        serialNumber: null,
        acquiredOn: null,
        acquisitionValueCents: null,
        supplier: null,
        invoice: null,
        warrantyUntil: null,
        notes: null,
      }),
    ).toThrow(AppError)
  })
})

afterEach(() => {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
})
