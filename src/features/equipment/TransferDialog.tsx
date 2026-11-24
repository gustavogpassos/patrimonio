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
import type { EquipmentDetail, Sector } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function TransferDialog({
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
  const [sectors, setSectors] = useState<Sector[]>([])
  const [toSectorId, setToSectorId] = useState('')
  const [location, setLocation] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!open) return
    api.listSectors(false).then(setSectors).catch((err) => toast.error(err.message))
    setToSectorId(String(equipment.sectorId))
    setLocation(equipment.location ?? '')
    setDate(todayLocal())
    setReason('')
  }, [open, equipment])

  async function submit() {
    try {
      await api.transfer(equipment.id, {
        toSectorId: Number(toSectorId),
        toLocation: location,
        transferredOn: date,
        reason,
      })
      toast.success('Transfer recorded')
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
          <DialogTitle>Transfer equipment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Destination sector</Label>
            <Select value={toSectorId} onValueChange={setToSectorId}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map((sector) => (
                  <SelectItem key={sector.id} value={String(sector.id)}>
                    {sector.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Location</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>Transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
