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
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { todayLocal } from '@/lib/dates'
import type { EquipmentDetail } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function WriteOffDialog({
  open,
  onOpenChange,
  equipment,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentDetail
  onDone: () => void
}) {
  const [date, setDate] = useState(todayLocal())
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    setDate(todayLocal())
    setReason('')
  }, [open])

  async function submit() {
    try {
      await api.writeOff(equipment.id, { writtenOffOn: date, writeOffReason: reason })
      toast.success('Equipamento baixado')
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
          <DialogTitle>Baixar equipamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void submit()}>
            Baixar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
