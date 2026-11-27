import { describe, expect, test } from 'bun:test'
import { regularMaintenanceInfo, warrantyInfo } from './dates'

describe('warrantyInfo', () => {
  test('no warranty', () => {
    expect(warrantyInfo(null, '2026-11-19').kind).toBe('none')
  })

  test('expired', () => {
    const info = warrantyInfo('2026-11-01', '2026-11-19')
    expect(info.kind).toBe('expired')
  })

  test('due in 30 days', () => {
    const info = warrantyInfo('2026-12-01', '2026-11-19')
    expect(info.kind).toBe('soon')
    if (info.kind === 'soon') expect(info.label).toContain('Vence em')
  })

  test('ok', () => {
    const info = warrantyInfo('2027-11-19', '2026-11-19')
    expect(info.kind).toBe('ok')
  })
})

describe('regularMaintenanceInfo', () => {
  test('no interval does not warn', () => {
    expect(
      regularMaintenanceInfo({
        intervalDays: null,
        registeredAt: '2026-01-01 10:00:00',
        lastCompletedOn: null,
        today: '2026-06-01',
      }).kind,
    ).toBe('none')
  })

  test('written off does not warn', () => {
    expect(
      regularMaintenanceInfo({
        intervalDays: 30,
        registeredAt: '2026-01-01',
        lastCompletedOn: null,
        today: '2026-06-01',
        writtenOff: true,
      }).kind,
    ).toBe('none')
  })

  test('the count starts on registration and is due that day', () => {
    const info = regularMaintenanceInfo({
      intervalDays: 30,
      registeredAt: '2026-01-01 15:30:00',
      lastCompletedOn: null,
      today: '2026-01-31',
    })
    expect(info).toMatchObject({
      kind: 'due',
      dueOn: '2026-01-31',
      label: 'Manutenção hoje',
    })
  })

  test('before the deadline it is on time', () => {
    const info = regularMaintenanceInfo({
      intervalDays: 30,
      registeredAt: '2026-01-01',
      lastCompletedOn: null,
      today: '2026-01-30',
    })
    expect(info.kind).toBe('ok')
    if (info.kind === 'ok') expect(info.dueOn).toBe('2026-01-31')
  })

  test('after the deadline it reports the delay', () => {
    const info = regularMaintenanceInfo({
      intervalDays: 30,
      registeredAt: '2026-01-01',
      lastCompletedOn: null,
      today: '2026-02-02',
    })
    expect(info).toMatchObject({ kind: 'due', label: 'Atrasada há 2 dias' })
  })

  test('completed maintenance restarts the count', () => {
    const info = regularMaintenanceInfo({
      intervalDays: 30,
      registeredAt: '2026-01-01',
      lastCompletedOn: '2026-02-01',
      today: '2026-02-10',
    })
    expect(info.kind).toBe('ok')
    if (info.kind === 'ok') expect(info.dueOn).toBe('2026-03-03')
  })
})
