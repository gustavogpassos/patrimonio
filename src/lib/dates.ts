export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDatePt(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function daysUntil(iso: string, today = todayLocal()): number {
  const a = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  )
  const b = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  )
  return Math.round((b - a) / 86_400_000)
}

export type GarantiaInfo =
  | { kind: 'none'; label: 'Sem garantia' }
  | { kind: 'ok'; label: string; days: number }
  | { kind: 'soon'; label: string; days: number }
  | { kind: 'expired'; label: 'Garantia vencida'; days: number }

export function garantiaInfo(
  garantiaAte: string | null | undefined,
  today = todayLocal(),
): GarantiaInfo {
  if (!garantiaAte) return { kind: 'none', label: 'Sem garantia' }
  const days = daysUntil(garantiaAte, today)
  if (days < 0) return { kind: 'expired', label: 'Garantia vencida', days }
  if (days <= 30) {
    return {
      kind: 'soon',
      label: days === 0 ? 'Vence hoje' : `Vence em ${days} dias`,
      days,
    }
  }
  return { kind: 'ok', label: formatDatePt(garantiaAte), days }
}

export function isFutureDate(iso: string, today = todayLocal()): boolean {
  return iso > today
}

export function isBefore(a: string, b: string): boolean {
  return a < b
}

export function dateOnly(iso: string): string {
  return iso.slice(0, 10)
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${dateOnly(isoDate)}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export type ManutencaoRegularInfo =
  | { kind: 'none' }
  | { kind: 'ok'; vencimento: string; days: number; label: string }
  | { kind: 'due'; vencimento: string; days: number; label: string }

export function manutencaoRegularInfo(input: {
  intervaloDias: number | null | undefined
  cadastradoEm: string
  ultimaConclusao: string | null
  today?: string
  baixado?: boolean
}): ManutencaoRegularInfo {
  if (input.baixado || input.intervaloDias == null || input.intervaloDias < 1) {
    return { kind: 'none' }
  }
  const ancora = input.ultimaConclusao
    ? dateOnly(input.ultimaConclusao)
    : dateOnly(input.cadastradoEm)
  const vencimento = addDays(ancora, input.intervaloDias)
  const today = input.today ?? todayLocal()
  const days = daysUntil(vencimento, today)
  if (days > 0) {
    return { kind: 'ok', vencimento, days, label: formatDatePt(vencimento) }
  }
  if (days === 0) {
    return { kind: 'due', vencimento, days, label: 'Manutenção hoje' }
  }
  const atraso = -days
  return {
    kind: 'due',
    vencimento,
    days,
    label: atraso === 1 ? 'Atrasada há 1 dia' : `Atrasada há ${atraso} dias`,
  }
}
