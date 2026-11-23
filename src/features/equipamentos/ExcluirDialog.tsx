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
import { api } from '@/lib/api'
import type { EquipamentoDetalhe } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function ExcluirDialog({
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
  const [confirmacao, setConfirmacao] = useState('')

  useEffect(() => {
    if (open) setConfirmacao('')
  }, [open])

  const ok =
    confirmacao.trim().toLowerCase() === equipamento.tombamento.toLowerCase()

  async function submit() {
    try {
      await api.excluir(equipamento.id, confirmacao)
      toast.success('Equipamento excluído')
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
          <DialogTitle>Excluir equipamento</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Movimentações e manutenções também serão apagadas. Digite o tombamento{' '}
          <strong>{equipamento.tombamento}</strong> para confirmar.
        </p>
        <div className="space-y-1">
          <Label>Tombamento</Label>
          <Input
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!ok} onClick={() => void submit()}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
