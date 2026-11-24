import { describe, expect, test } from 'bun:test'
import { buildEquipmentCsv } from './csv'
import type { EquipmentListItem } from './types'

const sample: EquipmentListItem = {
  id: 1,
  assetTag: 'PAT-000001',
  name: 'PC; Lab',
  description: 'line\nbreak',
  categoryId: 1,
  categoryName: 'Computer',
  categoryActive: true,
  categoryRegularMaintenance: false,
  categoryMaintenanceIntervalDays: null,
  lastMaintenanceCompletedAt: null,
  sectorId: 1,
  sectorName: 'IT',
  sectorActive: true,
  location: null,
  brand: 'Dell',
  model: 'OptiPlex',
  serialNumber: 'ABC',
  status: 'in_use',
  acquiredOn: '2024-01-10',
  acquisitionValueCents: 150050,
  supplier: null,
  invoice: null,
  warrantyUntil: null,
  notes: null,
  writeOffReason: null,
  writtenOffOn: null,
  createdAt: '',
  updatedAt: '',
}

describe('csv', () => {
  test('BOM and separator', () => {
    const csv = buildEquipmentCsv([sample])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain(';')
    expect(csv).toContain('location')
    expect(csv).not.toContain('complement')
    expect(csv).toContain('In use')
    expect(csv).toContain('1500,50')
    expect(csv).toContain('"PC; Lab"')
  })
})
