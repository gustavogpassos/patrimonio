import {
  MAINTENANCE_STATE_LABELS,
  STATUS_LABELS,
  type EquipmentStatus,
  type MaintenanceState,
} from '@/lib/types'
import { cn } from '@/lib/utils'

const variants: Record<EquipmentStatus, string> = {
  in_use: 'bg-emerald-600 text-white',
  in_stock: 'bg-sky-600 text-white',
  in_maintenance: 'bg-amber-500 text-amber-950',
  written_off: 'bg-rose-600 text-white',
}

export function StatusBadge({ status }: { status: EquipmentStatus }) {
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

const stateVariants: Record<MaintenanceState, string> = {
  open: 'bg-amber-500 text-amber-950',
  completed: 'bg-emerald-600 text-white',
  cancelled: 'bg-zinc-500 text-white',
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap',
        active ? 'bg-emerald-600 text-white' : 'bg-zinc-500 text-white',
      )}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export function MaintenanceStateBadge({ state }: { state: MaintenanceState }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap',
        stateVariants[state],
      )}
    >
      {MAINTENANCE_STATE_LABELS[state]}
    </span>
  )
}
