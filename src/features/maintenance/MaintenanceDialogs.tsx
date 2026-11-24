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
        toast.error('Custo inválido')
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
      toast.success('Manutenção aberta')
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova manutenção</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!equipmentId && (
            <>
              <div className="space-y-1">
                <Label>Buscar equipamento</Label>
                <Input value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Equipamento</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
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
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corrective">Corretiva</SelectItem>
                <SelectItem value="preventive">Preventiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Data de abertura</Label>
            <Input
              type="date"
              value={openedOn}
              onChange={(e) => setOpenedOn(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Problema</Label>
            <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Custo (R$)</Label>
            <Input value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Assistência</Label>
            <Input value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()}>Abrir</Button>
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
        toast.error('Custo inválido')
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
      toast.success('Manutenção concluída')
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir manutenção</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Data de conclusão</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Solução</Label>
            <Textarea value={solution} onChange={(e) => setSolution(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Custo (R$)</Label>
            <Input value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Assistência</Label>
            <Input value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Status seguinte</Label>
            <Select
              value={statusAfter}
              onValueChange={(value) => setStatusAfter(value as typeof statusAfter)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_use">Em uso</SelectItem>
                <SelectItem value="in_stock">Em estoque</SelectItem>
                <SelectItem value="written_off">Baixado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {statusAfter === 'written_off' && (
            <div className="space-y-1">
              <Label>Motivo da baixa</Label>
              <Textarea
                value={writeOffReason}
                onChange={(e) => setWriteOffReason(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()}>Concluir</Button>
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
      toast.success('Manutenção cancelada')
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar manutenção</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Motivo</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={() => void submit()}>
            Cancelar manutenção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
