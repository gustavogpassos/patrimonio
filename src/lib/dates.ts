export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDate(iso: string | null | undefined): string {
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

export type WarrantyInfo =
  | { kind: 'none'; label: 'No warranty' }
  | { kind: 'ok'; label: string; days: number }
  | { kind: 'soon'; label: string; days: number }
  | { kind: 'expired'; label: 'Warranty expired'; days: number }

export function warrantyInfo(
  warrantyUntil: string | null | undefined,
  today = todayLocal(),
): WarrantyInfo {
  if (!warrantyUntil) return { kind: 'none', label: 'No warranty' }
  const days = daysUntil(warrantyUntil, today)
  if (days < 0) return { kind: 'expired', label: 'Warranty expired', days }
  if (days <= 30) {
    return {
      kind: 'soon',
      label: days === 0 ? 'Due today' : `Due in ${days} days`,
      days,
    }
  }
  return { kind: 'ok', label: formatDate(warrantyUntil), days }
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

export type RegularMaintenanceInfo =
  | { kind: 'none' }
  | { kind: 'ok'; dueOn: string; days: number; label: string }
  | { kind: 'due'; dueOn: string; days: number; label: string }

export function regularMaintenanceInfo(input: {
  intervalDays: number | null | undefined
  registeredAt: string
  lastCompletedOn: string | null
  today?: string
  writtenOff?: boolean
}): RegularMaintenanceInfo {
  if (input.writtenOff || input.intervalDays == null || input.intervalDays < 1) {
    return { kind: 'none' }
  }
  const anchor = input.lastCompletedOn
    ? dateOnly(input.lastCompletedOn)
    : dateOnly(input.registeredAt)
  const dueOn = addDays(anchor, input.intervalDays)
  const today = input.today ?? todayLocal()
  const days = daysUntil(dueOn, today)
  if (days > 0) {
    return { kind: 'ok', dueOn, days, label: formatDate(dueOn) }
  }
  if (days === 0) {
    return { kind: 'due', dueOn, days, label: 'Maintenance due today' }
  }
  const overdue = -days
  return {
    kind: 'due',
    dueOn,
    days,
    label: overdue === 1 ? 'Overdue by 1 day' : `Overdue by ${overdue} days`,
  }
}
