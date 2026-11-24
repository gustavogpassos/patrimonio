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
      toast.error(err instanceof Error ? err.message : 'Erro')
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
        toast.error('Informe a frequência da manutenção regular, em dias.')
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
      toast.success(editing ? 'Categoria atualizada' : 'Categoria cadastrada')
      setOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
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
      toast.success(category.active ? 'Categoria inativada' : 'Categoria reativada')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  async function remove(category: Category) {
    if (!window.confirm(`Excluir a categoria "${category.name}"?`)) return
    try {
      await api.deleteCategory(category.id)
      toast.success('Categoria excluída')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Categorias</h2>
          <p className="text-muted-foreground">Tipos de equipamentos de informática</p>
        </div>
        <Button onClick={openNew}>Nova categoria</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Nenhuma categoria cadastrada"
          action={<Button onClick={openNew}>Nova categoria</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Manutenção</TableHead>
              <TableHead>Equipamentos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>{category.description ?? '—'}</TableCell>
                <TableCell>
                  {category.regularMaintenance && category.maintenanceIntervalDays
                    ? `A cada ${category.maintenanceIntervalDays} ${category.maintenanceIntervalDays === 1 ? 'dia' : 'dias'}`
                    : '—'}
                </TableCell>
                <TableCell>{category.equipmentCount}</TableCell>
                <TableCell>
                  <ActiveBadge active={category.active} />
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(category)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void toggleActive(category)}>
                    {category.active ? 'Inativar' : 'Reativar'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void remove(category)}>
                    Excluir
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
            <DialogTitle>{editing ? 'Editar categoria' : 'Nova categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Descrição</Label>
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
              Ativo
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={regularMaintenance}
                onChange={(e) => setRegularMaintenance(e.target.checked)}
              />
              Manutenção regular
            </label>
            {regularMaintenance && (
              <div className="space-y-1">
                <Label htmlFor="interval">Frequência (dias)</Label>
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
              Cancelar
            </Button>
            <Button onClick={() => void save()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
