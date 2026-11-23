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
import type { Setor } from '@/lib/types'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

export function SetoresPage() {
  const [items, setItems] = useState<Setor[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Setor | null>(null)
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [ativo, setAtivo] = useState(true)

  async function load() {
    try {
      setItems(await api.listSetores(true))
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

  function openEdit(s: Setor) {
    setEditing(s)
    setNome(s.nome)
    setDescricao(s.descricao ?? '')
    setAtivo(s.ativo)
    setOpen(true)
  }

  async function save() {
    try {
      await api.saveSetor({
        id: editing?.id,
        nome,
        descricao,
        ativo,
      })
      toast.success(editing ? 'Setor atualizado' : 'Setor cadastrado')
      setOpen(false)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  async function toggleAtivo(s: Setor) {
    try {
      await api.saveSetor({
        id: s.id,
        nome: s.nome,
        descricao: s.descricao ?? '',
        ativo: !s.ativo,
      })
      toast.success(s.ativo ? 'Setor inativado' : 'Setor reativado')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  async function remove(s: Setor) {
    if (!window.confirm(`Excluir o setor "${s.nome}"?`)) return
    try {
      await api.deleteSetor(s.id)
      toast.success('Setor excluído')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Setores</h2>
          <p className="text-muted-foreground">Locais onde os equipamentos ficam</p>
        </div>
        <Button onClick={openNew}>Novo setor</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nenhum setor cadastrado" action={<Button onClick={openNew}>Novo setor</Button>} />
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
            {items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.nome}</TableCell>
                <TableCell>{s.descricao ?? '—'}</TableCell>
                <TableCell>{s.equipamentosCount}</TableCell>
                <TableCell>
                  <AtivoBadge ativo={s.ativo} />
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void toggleAtivo(s)}>
                    {s.ativo ? 'Inativar' : 'Reativar'}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void remove(s)}>
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
            <DialogTitle>{editing ? 'Editar setor' : 'Novo setor'}</DialogTitle>
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
