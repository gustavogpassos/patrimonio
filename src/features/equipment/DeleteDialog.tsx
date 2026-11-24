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
      toast.success('Equipment deleted')
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
          <DialogTitle>Delete equipment</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Transfers and maintenance records will also be deleted. Type the asset tag{' '}
          <strong>{equipment.assetTag}</strong> to confirm.
        </p>
        <div className="space-y-1">
          <Label>Asset tag</Label>
          <Input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!matches} onClick={() => void submit()}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
