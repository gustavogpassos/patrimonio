import {
  SITUACAO_MANUTENCAO_LABELS,
  STATUS_LABELS,
  type SituacaoManutencao,
  type StatusEquipamento,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const variants: Record<StatusEquipamento, string> = {
  em_uso: 'bg-emerald-600 text-white',
  em_estoque: 'bg-sky-600 text-white',
  em_manutencao: 'bg-amber-500 text-amber-950',
  baixado: 'bg-rose-600 text-white',
}

export function StatusBadge({ status }: { status: StatusEquipamento }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap',
        variants[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

const situacaoVariants: Record<SituacaoManutencao, string> = {
  aberta: 'bg-amber-500 text-amber-950',
  concluida: 'bg-emerald-600 text-white',
  cancelada: 'bg-zinc-500 text-white',
}

export function AtivoBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap',
        ativo ? 'bg-emerald-600 text-white' : 'bg-zinc-500 text-white',
      )}
    >
      {ativo ? 'Ativo' : 'Inativo'}
    </span>
  )
}

export function SituacaoBadge({ situacao }: { situacao: SituacaoManutencao }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap',
        situacaoVariants[situacao],
      )}
    >
      {SITUACAO_MANUTENCAO_LABELS[situacao]}
    </span>
  )
}
