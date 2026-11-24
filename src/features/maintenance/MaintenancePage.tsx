import { EmptyState } from '@/components/EmptyState'
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
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  useEffect(() => {
    void load()
  }, [state, type, q, page])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Maintenance</h2>
          <p className="text-muted-foreground">History and open orders</p>
        </div>
        <Button onClick={() => setOpenNew(true)}>New maintenance</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search by name or asset tag…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <Select value={state} onValueChange={(value) => { setState(value); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(value) => { setType(value); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="corrective">Corrective</SelectItem>
            <SelectItem value="preventive">Preventive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No maintenance found" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Problem</TableHead>
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
                          Complete
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setCancelTarget(item)}>
                          Cancel
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
