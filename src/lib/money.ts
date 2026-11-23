export function formatBRL(centavos: number | null | undefined): string {
  if (centavos == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(centavos / 100)
}

export function formatBRLPlain(centavos: number | null | undefined): string {
  if (centavos == null) return ''
  return (centavos / 100).toFixed(2).replace('.', ',')
}

/** Aceita "1.234,56", "1234,56" ou "1234.56" e devolve centavos. */
export function parseBRLToCentavos(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  let normalized = t.replace(/\s/g, '')
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  }
  const n = Number(normalized)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Valor inválido')
  }
  return Math.round(n * 100)
}
