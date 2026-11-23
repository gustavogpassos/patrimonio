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
import type { EquipamentoDetalhe, Setor } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function TransferirDialog({
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
  const [setores, setSetores] = useState<Setor[]>([])
  const [setorDestinoId, setSetorDestinoId] = useState('')
  const [complemento, setComplemento] = useState('')
  const [data, setData] = useState(todayLocal())
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (!open) return
    api.listSetores(false).then(setSetores).catch((e) => toast.error(e.message))
    setSetorDestinoId(String(equipamento.setorId))
    setComplemento(equipamento.complementoLocal ?? '')
    setData(todayLocal())
    setMotivo('')
  }, [open, equipamento])

  async function submit() {
    try {
      await api.transferir(equipamento.id, {
        setorDestinoId: Number(setorDestinoId),
        complementoDestino: complemento,
        dataMovimentacao: data,
        motivo,
      })
      toast.success('Transferência registrada')
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
          <DialogTitle>Transferir equipamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Setor de destino</Label>
            <Select value={setorDestinoId} onValueChange={setSetorDestinoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {setores.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Complemento</Label>
            <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
          </div>
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
          <Button onClick={() => void submit()}>Transferir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
