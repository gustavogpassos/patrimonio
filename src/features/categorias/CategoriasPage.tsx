import { AtivoBadge } from '@/components/StatusBadge'
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
import type { Categoria } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function CategoriasPage() {
  const [items, setItems] = useState<Categoria[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Categoria | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ativo, setAtivo] = useState(true)

  async function load() {
    try {
      setItems(await api.listCategorias(true))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function openNew() {
    setEditing(null)
    setNome('')
    setDescricao('')
    setAtivo(true)
    setOpen(true)
  }

  function openEdit(c: Categoria) {
    setEditing(c)
    setNome(c.nome)
    setDescricao(c.descricao ?? '')
    setAtivo(c.ativo)
    setOpen(true)
  }

  async function save() {
    try {
      await api.saveCategoria({
        id: editing?.id,
        nome,
        descricao,
        ativo,
      })
      toast.success(editing ? 'Categoria atualizada' : 'Categoria cadastrada')
      setOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  async function toggleAtivo(c: Categoria) {
    try {
      await api.saveCategoria({
        id: c.id,
        nome: c.nome,
        descricao: c.descricao ?? '',
        ativo: !c.ativo,
      })
      toast.success(c.ativo ? 'Categoria inativada' : 'Categoria reativada')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  async function remove(c: Categoria) {
    if (!window.confirm(`Excluir a categoria "${c.nome}"?`)) return
    try {
      await api.deleteCategoria(c.id)
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
              <TableHead>Equipamentos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.descricao ?? '—'}</TableCell>
                <TableCell>{c.equipamentosCount}</TableCell>
                <TableCell>
                  <AtivoBadge ativo={c.ativo} />
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void toggleAtivo(c)}>
                    {c.ativo ? 'Inativar' : 'Reativar'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void remove(c)}>
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
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              Ativo
            </label>
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
