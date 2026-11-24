import { Badge } from '@/components/ui/badge'
import { manutencaoRegularInfo } from '@/lib/dates'

export function ManutencaoRegularBadge({
  intervaloDias,
  cadastradoEm,
  ultimaConclusao,
  baixado = false,
}: {
  intervaloDias: number | null
  cadastradoEm: string
  ultimaConclusao: string | null
  baixado?: boolean
}) {
  const info = manutencaoRegularInfo({
    intervaloDias: baixado ? null : intervaloDias,
    cadastradoEm,
    ultimaConclusao,
    baixado,
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
