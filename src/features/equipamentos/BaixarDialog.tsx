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
import type { EquipamentoDetalhe } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function BaixarDialog({
  open,
  onOpenChange,
  equipamento,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  equipamento: EquipamentoDetalhe
  onDone: () => void
}) {
  const [data, setData] = useState(todayLocal())
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (!open) return
    setData(todayLocal())
    setMotivo('')
  }, [open])

  async function submit() {
    try {
      await api.baixar(equipamento.id, { dataBaixa: data, motivoBaixa: motivo })
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
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Motivo</Label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
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
