import { EmptyState } from '@/components/EmptyState'
import { GarantiaBadge } from '@/components/GarantiaBadge'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { buildEquipamentosCsv, downloadTextFile } from '@/lib/csv'
import { todayLocal } from '@/lib/dates'
import type { Categoria, EquipamentoListItem, Setor, StatusEquipamento } from '@/lib/types'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

export function EquipamentosPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [items, setItems] = useState<EquipamentoListItem[]>([])
  const [total, setTotal] = useState(0)
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [setores, setSetores] = useState<Setor[]>([])
  const [qInput, setQInput] = useState(params.get('q') ?? '')

  const q = params.get('q') ?? ''
  const categoriaId = params.get('categoriaId')
  const setorId = params.get('setorId')
  const status = params.get('status') as StatusEquipamento | null
  const page = Number(params.get('page') ?? '1')

  const hasFilters = Boolean(q || categoriaId || setorId || status)

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (qInput) next.set('q', qInput)
      else next.delete('q')
      next.set('page', '1')
      if (qInput !== q) setParams(next)
    }, 300)
    return () => clearTimeout(t)
  }, [qInput]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([api.listCategorias(true), api.listSetores(true)])
      .then(([c, s]) => {
        setCategorias(c)
        setSetores(s)
      })
      .catch((e) => toast.error(e.message))
  }, [])

  useEffect(() => {
    api
      .listEquipamentos({
        q: q || undefined,
        categoriaId: categoriaId ? Number(categoriaId) : undefined,
        setorId: setorId ? Number(setorId) : undefined,
        status: status || undefined,
        page,
        pageSize: 20,
      })
      .then((r) => {
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e) => toast.error(e.message))
  }, [q, categoriaId, setorId, status, page])

  function updateParam(key: string, value: string | null) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.set('page', '1')
    setParams(next)
  }

  function clearFilters() {
    setQInput('')
    setParams(new URLSearchParams())
  }

  async function exportCsv() {
    try {
      const all = await api.listEquipamentos({
        q: q || undefined,
        categoriaId: categoriaId ? Number(categoriaId) : undefined,
        setorId: setorId ? Number(setorId) : undefined,
        status: status || undefined,
        pageSize: 0,
      })
      const csv = buildEquipamentosCsv(all.items)
      downloadTextFile(
        `patrimonio-equipamentos-${todayLocal()}.csv`,
        csv,
        'text/csv;charset=utf-8',
      )
      toast.success('CSV exportado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  const emptyTitle = useMemo(
    () =>
      hasFilters
        ? 'Nenhum equipamento encontrado'
        : 'Nenhum equipamento cadastrado',
    [hasFilters],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Equipamentos</h2>
          <p className="text-muted-foreground">Inventário de informática</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void exportCsv()}>
            Exportar CSV
          </Button>
          <Button asChild>
            <Link to="/equipamentos/novo">Novo equipamento</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Buscar…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <Select
          value={categoriaId ?? 'all'}
          onValueChange={(v) => updateParam('categoriaId', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={setorId ?? 'all'}
          onValueChange={(v) => updateParam('setorId', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos setores</SelectItem>
            {setores.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status ?? 'all'}
          onValueChange={(v) => updateParam('status', v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="em_uso">Em uso</SelectItem>
            <SelectItem value="em_estoque">Em estoque</SelectItem>
            <SelectItem value="em_manutencao">Em manutenção</SelectItem>
            <SelectItem value="baixado">Baixado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="ghost" onClick={clearFilters}>
          Limpar filtros
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          action={
            !hasFilters ? (
              <Button asChild>
                <Link to="/equipamentos/novo">Novo equipamento</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tombamento</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Garantia</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" to={`/equipamentos/${e.id}`}>
                      {e.tombamento}
                    </Link>
                  </TableCell>
                  <TableCell>{e.nome}</TableCell>
                  <TableCell>
                    {e.categoriaNome}
                    {!e.categoriaAtivo && (
                      <span className="ml-1 text-xs text-muted-foreground">(Inativo)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {e.setorNome}
                    {!e.setorAtivo && (
                      <span className="ml-1 text-xs text-muted-foreground">(Inativo)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={e.status} />
                  </TableCell>
                  <TableCell>
                    <GarantiaBadge garantiaAte={e.garantiaAte} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/equipamentos/${e.id}`)}>
                          Abrir
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/equipamentos/${e.id}/editar`)}
                        >
                          Editar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={page}
            pageSize={20}
            total={total}
            onPageChange={(p) => {
              const next = new URLSearchParams(params)
              next.set('page', String(p))
              setParams(next)
            }}
          />
        </>
      )}
    </div>
  )
}
