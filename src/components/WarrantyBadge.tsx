import { Badge } from '@/components/ui/badge'
import { warrantyInfo } from '@/lib/dates'

export function WarrantyBadge({ warrantyUntil }: { warrantyUntil: string | null }) {
  const info = warrantyInfo(warrantyUntil)
  const className =
    info.kind === 'expired'
      ? 'bg-red-100 text-red-800 border-red-200'
      : info.kind === 'soon'
        ? 'bg-amber-100 text-amber-900 border-amber-200'
        : info.kind === 'none'
          ? 'bg-zinc-100 text-zinc-600 border-zinc-200'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200'

  return (
    <Badge variant="outline" className={className}>
      {info.label}
    </Badge>
  )
}
