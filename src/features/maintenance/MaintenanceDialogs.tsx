import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { todayLocal } from '@/lib/dates'
import { parseBRLToCents } from '@/lib/money'
import type { EquipmentListItem, Maintenance } from '@/lib/types'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

export function OpenMaintenanceDialog({
  open,
  onOpenChange,
  equipmentId,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentId?: number
  onDone: () => void
}) {
  const [equipment, setEquipment] = useState<EquipmentListItem[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(equipmentId ? String(equipmentId) : '')
  const [type, setType] = useState<'corrective' | 'preventive'>('corrective')
  const [openedOn, setOpenedOn] = useState(todayLocal())
  const [problem, setProblem] = useState('')
  const [cost, setCost] = useState('')
  const [serviceProvider, setServiceProvider] = useState('')

  useEffect(() => {
    if (!open) return
    setType('corrective')
    setOpenedOn(todayLocal())
    setProblem('')
    setCost('')
    setServiceProvider('')
    setSelectedId(equipmentId ? String(equipmentId) : '')
    setQuery('')
    if (!equipmentId) {
      api
        .listEquipment({ pageSize: 0 })
        .then((result) => setEquipment(result.items.filter((item) => item.status !== 'written_off')))
        .catch((err) => toast.error(err.message))
    }
  }, [open, equipmentId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return equipment.slice(0, 50)
    return equipment
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.assetTag.toLowerCase().includes(q),
      )
      .slice(0, 50)
  }, [equipment, query])

  async function submit() {
    try {
      let costCents: number | null = null
      try {
        costCents = parseBRLToCents(cost)
      } catch {
        toast.error('Invalid cost')
        return
      }
      await api.openMaintenance({
        equipmentId: Number(selectedId),
        type,
        openedOn,
        problem,
        costCents,
        serviceProvider,
      })
      toast.success('Maintenance opened')
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New maintenance</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!equipmentId && (
            <>
              <div className="space-y-1">
                <Label>Search equipment</Label>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Equipment</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {filtered.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.assetTag} · {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corrective">Corrective</SelectItem>
                <SelectItem value="preventive">Preventive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Opened on</Label>
            <Input
              type="date"
              value={openedOn}
              onChange={(e) => setOpenedOn(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Problem</Label>
            <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cost (R$)</Label>
            <Input value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Service provider</Label>
            <Input value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Open</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CompleteMaintenanceDialog({
  open,
  onOpenChange,
  maintenance,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  maintenance: Maintenance | null
  onDone: () => void
}) {
  const [date, setDate] = useState(todayLocal())
  const [solution, setSolution] = useState('')
  const [cost, setCost] = useState('')
  const [serviceProvider, setServiceProvider] = useState('')
  const [statusAfter, setStatusAfter] = useState<'in_use' | 'in_stock' | 'written_off'>('in_use')
  const [writeOffReason, setWriteOffReason] = useState('')

  useEffect(() => {
    if (!open || !maintenance) return
    setDate(todayLocal())
    setSolution('')
    setCost(
      maintenance.costCents != null
        ? (maintenance.costCents / 100).toFixed(2).replace('.', ',')
        : '',
    )
    setServiceProvider(maintenance.serviceProvider ?? '')
    setStatusAfter('in_use')
    setWriteOffReason('')
  }, [open, maintenance])

  async function submit() {
    if (!maintenance) return
    try {
      let costCents: number | null = null
      try {
        costCents = parseBRLToCents(cost)
      } catch {
        toast.error('Invalid cost')
        return
      }
      await api.completeMaintenance(maintenance.id, {
        completedOn: date,
        solution,
        costCents,
        serviceProvider,
        equipmentStatusAfter: statusAfter,
        writeOffReason: statusAfter === 'written_off' ? writeOffReason : null,
      })
      toast.success('Maintenance completed')
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete maintenance</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Completed on</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Solution</Label>
            <Textarea value={solution} onChange={(e) => setSolution(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Cost (R$)</Label>
            <Input value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Service provider</Label>
            <Input value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Next status</Label>
            <Select
              value={statusAfter}
              onValueChange={(value) => setStatusAfter(value as typeof statusAfter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_use">In use</SelectItem>
                <SelectItem value="in_stock">In stock</SelectItem>
                <SelectItem value="written_off">Written off</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {statusAfter === 'written_off' && (
            <div className="space-y-1">
              <Label>Write-off reason</Label>
              <Textarea
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Complete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CancelMaintenanceDialog({
  open,
  onOpenChange,
  maintenance,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  maintenance: Maintenance | null
  onDone: () => void
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  async function submit() {
    if (!maintenance) return
    try {
      await api.cancelMaintenance(maintenance.id, { cancellationReason: reason })
      toast.success('Maintenance cancelled')
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel maintenance</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Reason</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button variant="destructive" onClick={() => void submit()}>
            Cancel maintenance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
