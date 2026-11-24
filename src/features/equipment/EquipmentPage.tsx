import { EmptyState } from '@/components/EmptyState'
import { RegularMaintenanceBadge } from '@/components/RegularMaintenanceBadge'
import { Pagination } from '@/components/Pagination'
import { StatusBadge } from '@/components/StatusBadge'
import { WarrantyBadge } from '@/components/WarrantyBadge'
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
import { buildEquipmentCsv, downloadTextFile } from '@/lib/csv'
import { todayLocal } from '@/lib/dates'
import type { Category, EquipmentListItem, EquipmentStatus, Sector } from '@/lib/types'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

export function EquipmentPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const [items, setItems] = useState<EquipmentListItem[]>([])
  const [total, setTotal] = useState(0)
  const [categories, setCategories] = useState<Category[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [qInput, setQInput] = useState(params.get('q') ?? '')

  const q = params.get('q') ?? ''
  const categoryId = params.get('categoryId')
  const sectorId = params.get('sectorId')
  const status = params.get('status') as EquipmentStatus | null
  const page = Number(params.get('page') ?? '1')

  const hasFilters = Boolean(q || categoryId || sectorId || status)

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (qInput) next.set('q', qInput)
      else next.delete('q')
      next.set('page', '1')
      if (qInput !== q) setParams(next)
    }, 300)
    return () => clearTimeout(timer)
  }, [qInput]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([api.listCategories(true), api.listSectors(true)])
      .then(([categoryList, sectorList]) => {
        setCategories(categoryList)
        setSectors(sectorList)
      })
      .catch((err) => toast.error(err.message))
  }, [])

  useEffect(() => {
    api
      .listEquipment({
        q: q || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        sectorId: sectorId ? Number(sectorId) : undefined,
        status: status || undefined,
        page,
        pageSize: 20,
      })
      .then((result) => {
        setItems(result.items)
        setTotal(result.total)
      })
      .catch((err) => toast.error(err.message))
  }, [q, categoryId, sectorId, status, page])

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
      const all = await api.listEquipment({
        q: q || undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        sectorId: sectorId ? Number(sectorId) : undefined,
        status: status || undefined,
        pageSize: 0,
      })
      const csv = buildEquipmentCsv(all.items)
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
            <Link to="/equipment/new">Novo equipamento</Link>
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
          value={categoryId ?? 'all'}
          onValueChange={(value) => updateParam('categoryId', value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={String(category.id)}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={sectorId ?? 'all'}
          onValueChange={(value) => updateParam('sectorId', value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos setores</SelectItem>
            {sectors.map((sector) => (
              <SelectItem key={sector.id} value={String(sector.id)}>
                {sector.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status ?? 'all'}
          onValueChange={(value) => updateParam('status', value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="in_use">Em uso</SelectItem>
            <SelectItem value="in_stock">Em estoque</SelectItem>
            <SelectItem value="in_maintenance">Em manutenção</SelectItem>
            <SelectItem value="written_off">Baixado</SelectItem>
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
                <Link to="/equipment/new">Novo equipamento</Link>
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
                <TableHead>Manutenção</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" to={`/equipment/${item.id}`}>
                      {item.assetTag}
                    </Link>
                  </TableCell>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>
                    {item.categoryName}
                    {!item.categoryActive && (
                      <span className="ml-1 text-xs text-muted-foreground">(Inativo)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.sectorName}
                    {!item.sectorActive && (
                      <span className="ml-1 text-xs text-muted-foreground">(Inativo)</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    <WarrantyBadge warrantyUntil={item.warrantyUntil} />
                  </TableCell>
                  <TableCell>
                    <RegularMaintenanceBadge
                      intervalDays={
                        item.categoryRegularMaintenance
                          ? item.categoryMaintenanceIntervalDays
                          : null
                      }
                      registeredAt={item.createdAt}
                      lastCompletedOn={item.lastMaintenanceCompletedAt}
                      writtenOff={item.status === 'written_off'}
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/equipment/${item.id}`)}>
                          Abrir
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/equipment/${item.id}/edit`)}
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
            onPageChange={(nextPage) => {
              const next = new URLSearchParams(params)
              next.set('page', String(nextPage))
              setParams(next)
            }}
          />
        </>
      )}
    </div>
  )
}
