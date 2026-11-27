import { Badge } from '@/components/ui/badge'
import { regularMaintenanceInfo } from '@/lib/dates'

export function RegularMaintenanceBadge({
  intervalDays,
  registeredAt,
  lastCompletedOn,
  writtenOff = false,
}: {
  intervalDays: number | null
  registeredAt: string
  lastCompletedOn: string | null
  writtenOff?: boolean
}) {
  const info = regularMaintenanceInfo({
    intervalDays: writtenOff ? null : intervalDays,
    registeredAt,
    lastCompletedOn,
    writtenOff,
  })
  if (info.kind === 'none') return <span className="text-muted-foreground">—</span>
  if (info.kind === 'ok') {
    return <span className="text-muted-foreground">{info.label}</span>
  }
  return (
    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
      {info.label}
    </Badge>
  )
}
