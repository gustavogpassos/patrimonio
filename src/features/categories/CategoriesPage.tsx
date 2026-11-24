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
import type { Category } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [active, setActive] = useState(true)
  const [regularMaintenance, setRegularMaintenance] = useState(false)
  const [interval, setInterval] = useState('')

  async function load() {
    try {
      setItems(await api.listCategories(true))
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
    setRegularMaintenance(false)
    setInterval('')
    setOpen(true)
  }

  function openEdit(category: Category) {
    setEditing(category)
    setName(category.name)
    setDescription(category.description ?? '')
    setActive(category.active)
    setRegularMaintenance(category.regularMaintenance)
    setInterval(
      category.maintenanceIntervalDays ? String(category.maintenanceIntervalDays) : '',
    )
    setOpen(true)
  }

  async function save() {
    let maintenanceIntervalDays: number | null = null
    if (regularMaintenance) {
      const days = Number(interval)
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        toast.error('Enter the regular maintenance interval, in days.')
        return
      }
      maintenanceIntervalDays = days
    }
    try {
      await api.saveCategory({
        id: editing?.id,
        name,
        description,
        active,
        regularMaintenance,
        maintenanceIntervalDays,
      })
      toast.success(editing ? 'Category updated' : 'Category created')
      setOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  async function toggleActive(category: Category) {
    try {
      await api.saveCategory({
        id: category.id,
        name: category.name,
        description: category.description ?? '',
        active: !category.active,
        regularMaintenance: category.regularMaintenance,
        maintenanceIntervalDays: category.maintenanceIntervalDays,
      })
      toast.success(category.active ? 'Category deactivated' : 'Category reactivated')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  async function remove(category: Category) {
    if (!window.confirm(`Delete category "${category.name}"?`)) return
    try {
      await api.deleteCategory(category.id)
      toast.success('Category deleted')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Categories</h2>
          <p className="text-muted-foreground">Types of IT equipment</p>
        </div>
        <Button onClick={openNew}>New category</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="No categories yet"
          action={<Button onClick={openNew}>New category</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Maintenance</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>{category.description ?? '—'}</TableCell>
                <TableCell>
                  {category.regularMaintenance && category.maintenanceIntervalDays
                    ? `Every ${category.maintenanceIntervalDays} ${category.maintenanceIntervalDays === 1 ? 'day' : 'days'}`
                    : '—'}
                </TableCell>
                <TableCell>{category.equipmentCount}</TableCell>
                <TableCell>
                  <ActiveBadge active={category.active} />
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(category)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void toggleActive(category)}>
                    {category.active ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void remove(category)}>
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
            <DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle>
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
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={regularMaintenance}
                onChange={(e) => setRegularMaintenance(e.target.checked)}
              />
              Regular maintenance
            </label>
            {regularMaintenance && (
              <div className="space-y-1">
                <Label htmlFor="interval">Interval (days)</Label>
                <Input
                  id="interval"
                  type="number"
                  min={1}
                  max={3650}
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                />
              </div>
            )}
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
