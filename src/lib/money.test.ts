import { describe, expect, test } from 'bun:test'
import { formatBRL, formatBRLPlain, parseBRLToCentavos } from './money'

describe('money', () => {
  test('formatBRL', () => {
    expect(formatBRL(null)).toBe('—')
    expect(formatBRL(12345)).toContain('123,45')
  })

  test('formatBRLPlain', () => {
    expect(formatBRLPlain(100)).toBe('1,00')
    expect(formatBRLPlain(null)).toBe('')
  })

  test('parseBRLToCentavos', () => {
    expect(parseBRLToCentavos('')).toBeNull()
    expect(parseBRLToCentavos('1.234,56')).toBe(123456)
    expect(parseBRLToCentavos('1234,56')).toBe(123456)
    expect(parseBRLToCentavos('1234.56')).toBe(123456)
  })
})
