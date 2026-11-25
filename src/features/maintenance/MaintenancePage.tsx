import { EmptyState } from '@/components/EmptyState'
import { ShortcutHint } from '@/components/ShortcutHint'
import { Pagination } from '@/components/Pagination'
import { MaintenanceStateBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/dates'
import { useShortcut } from '@/lib/shortcuts'
import type { Maintenance, MaintenanceState, MaintenanceType } from '@/lib/types'
import { MAINTENANCE_TYPE_LABELS } from '@/lib/types'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  CancelMaintenanceDialog,
  CompleteMaintenanceDialog,
  OpenMaintenanceDialog,
} from './MaintenanceDialogs'

export function MaintenancePage() {
  const [items, setItems] = useState<Maintenance[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [state, setState] = useState<string>('all')
  const [type, setType] = useState<string>('all')
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [openNew, setOpenNew] = useState(false)
  const [completeTarget, setCompleteTarget] = useState<Maintenance | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Maintenance | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(qInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [qInput])

  async function load() {
    try {
      const result = await api.listMaintenance({
        state: state === 'all' ? undefined : (state as MaintenanceState),
        type: type === 'all' ? undefined : (type as MaintenanceType),
        q: q || undefined,
        page,
        pageSize: 20,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  useEffect(() => {
    void load()
  }, [state, type, q, page])

  const dialogOpen = openNew || Boolean(completeTarget) || Boolean(cancelTarget)
  useShortcut('n', () => setOpenNew(true), { enabled: !dialogOpen, allowInField: true })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">Manutenções</h2>
          <p className="text-muted-foreground">Histórico e ordens em aberto</p>
        </div>
        <Button onClick={() => setOpenNew(true)} aria-keyshortcuts="Control+N">
          Nova manutenção
          <ShortcutHint keys="Ctrl N" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Buscar por nome ou tombamento…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <Select value={state} onValueChange={(value) => { setState(value); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="open">Aberta</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(value) => { setType(value); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="corrective">Corretiva</SelectItem>
            <SelectItem value="preventive">Preventiva</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nenhuma manutenção encontrada" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link
                      className="hover:underline"
                      to={`/equipment/${item.equipmentId}`}
                    >
                      {item.equipmentAssetTag} · {item.equipmentName}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDate(item.openedOn)}</TableCell>
                  <TableCell>{MAINTENANCE_TYPE_LABELS[item.type]}</TableCell>
                  <TableCell>
                    <MaintenanceStateBadge state={item.state} />
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{item.problem}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    {item.state === 'open' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setCompleteTarget(item)}>
                          Concluir
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setCancelTarget(item)}>
                          Cancelar
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={20} total={total} onPageChange={setPage} />
        </>
      )}

      <OpenMaintenanceDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onDone={() => void load()}
      />
      <CompleteMaintenanceDialog
        open={Boolean(completeTarget)}
        onOpenChange={(open) => !open && setCompleteTarget(null)}
        maintenance={completeTarget}
        onDone={() => void load()}
      />
      <CancelMaintenanceDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        maintenance={cancelTarget}
        onDone={() => void load()}
      />
    </div>
  )
}
