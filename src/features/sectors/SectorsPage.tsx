import { ActiveBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import type { Sector } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function SectorsPage() {
  const [items, setItems] = useState<Sector[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Sector | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)

  async function load() {
    try {
      setItems(await api.listSectors(true))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openNew() {
    setEditing(null)
    setName('')
    setDescription('')
    setActive(true)
    setOpen(true)
  }

  function openEdit(sector: Sector) {
    setEditing(sector)
    setName(sector.name)
    setDescription(sector.description ?? '')
    setActive(sector.active)
    setOpen(true)
  }

  async function save() {
    try {
      await api.saveSector({
        id: editing?.id,
        name,
        description,
        active,
      })
      toast.success(editing ? 'Sector updated' : 'Sector created')
      setOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  async function toggleActive(sector: Sector) {
    try {
      await api.saveSector({
        id: sector.id,
        name: sector.name,
        description: sector.description ?? '',
        active: !sector.active,
      })
      toast.success(sector.active ? 'Sector deactivated' : 'Sector reactivated')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  async function remove(sector: Sector) {
    if (!window.confirm(`Delete sector "${sector.name}"?`)) return
    try {
      await api.deleteSector(sector.id)
      toast.success('Sector deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Sectors</h2>
          <p className="text-muted-foreground">Where the equipment is assigned</p>
        </div>
        <Button onClick={openNew}>New sector</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title="No sectors yet" action={<Button onClick={openNew}>New sector</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((sector) => (
              <TableRow key={sector.id}>
                <TableCell className="font-medium">{sector.name}</TableCell>
                <TableCell>{sector.description ?? '—'}</TableCell>
                <TableCell>{sector.equipmentCount}</TableCell>
                <TableCell>
                  <ActiveBadge active={sector.active} />
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(sector)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void toggleActive(sector)}>
                    {sector.active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void remove(sector)}>
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit sector' : 'New sector'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
