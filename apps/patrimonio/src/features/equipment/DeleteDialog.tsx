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
import type { EquipmentDetail } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function DeleteDialog({
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
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    if (open) setConfirmation('')
  }, [open])

  const matches =
    confirmation.trim().toLowerCase() === equipment.assetTag.toLowerCase()

  async function submit() {
    try {
      await api.deleteEquipment(equipment.id, confirmation)
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
          <strong>{equipment.assetTag}</strong> para confirmar.
        </p>
        <div className="space-y-1">
          <Label>Tombamento</Label>
          <Input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!matches} onClick={() => void submit()}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
