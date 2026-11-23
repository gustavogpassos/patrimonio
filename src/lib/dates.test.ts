import { describe, expect, test } from 'bun:test'
import { garantiaInfo } from './dates'

describe('garantiaInfo', () => {
  test('sem garantia', () => {
    expect(garantiaInfo(null, '2026-11-19').kind).toBe('none')
  })

  test('vencida', () => {
    const info = garantiaInfo('2026-11-01', '2026-11-19')
    expect(info.kind).toBe('expired')
  })

  test('vence em 30', () => {
    const info = garantiaInfo('2026-12-01', '2026-11-19')
    expect(info.kind).toBe('soon')
    if (info.kind === 'soon') expect(info.label).toContain('Vence em')
  })

  test('ok', () => {
    const info = garantiaInfo('2027-11-19', '2026-11-19')
    expect(info.kind).toBe('ok')
  })
})
