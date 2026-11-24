export function formatBRL(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

export function formatBRLPlain(cents: number | null | undefined): string {
  if (cents == null) return ''
  return (cents / 100).toFixed(2).replace('.', ',')
}

/** Accepts "1.234,56", "1234,56", or "1234.56" and returns cents. */
export function parseBRLToCents(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  let normalized = t.replace(/\s/g, '')
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Invalid amount')
  }
  return Math.round(n * 100)
}
