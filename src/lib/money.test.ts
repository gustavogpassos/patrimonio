import { describe, expect, test } from 'bun:test'
import { formatBRL, formatBRLPlain, parseBRLToCents } from './money'

describe('money', () => {
  test('formatBRL', () => {
    expect(formatBRL(null)).toBe('—')
    expect(formatBRL(12345)).toContain('123,45')
  })

  test('formatBRLPlain', () => {
    expect(formatBRLPlain(100)).toBe('1,00')
    expect(formatBRLPlain(null)).toBe('')
  })

  test('parseBRLToCents', () => {
    expect(parseBRLToCents('')).toBeNull()
    expect(parseBRLToCents('1.234,56')).toBe(123456)
    expect(parseBRLToCents('1234,56')).toBe(123456)
    expect(parseBRLToCents('1234.56')).toBe(123456)
  })
})
