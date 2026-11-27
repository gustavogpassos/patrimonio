import { EmptyState } from '@/components/EmptyState'
import { RegularMaintenanceBadge } from '@/components/RegularMaintenanceBadge'
import { Pagination } from '@/components/Pagination'
import { ShortcutHint } from '@/components/ShortcutHint'
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
import { useShortcut } from '@/lib/shortcuts'
import type { Category, EquipmentListItem, EquipmentStatus, Sector } from '@/lib/types'
import { MoreHorizontal } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
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
  const [reloadKey, setReloadKey] = useState(0)
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([])

  function listState() {
    return { listSearch: params.toString() }
  }

  useShortcut('n', () => navigate('/equipment/new', { state: listState() }), {
    allowInField: true,
    alt: true,
  })

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
  }, [q, categoryId, sectorId, status, page, reloadKey])

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

  async function putInUse(item: EquipmentListItem) {
    if (!window.confirm(`Colocar "${item.name}" em uso?`)) return
    try {
      await api.markInUse(item.id)
      toast.success('Equipamento em uso')
      setReloadKey((current) => current + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, index: number) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      rowRefs.current[index + 1]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      rowRefs.current[index - 1]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      rowRefs.current[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      rowRefs.current[items.length - 1]?.focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      navigate(`/equipment/${items[index]?.id}`, { state: listState() })
    }
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
          <p className="hidden text-xs text-muted-foreground md:block">
            Alt+N cria um equipamento. Com o foco na linha, as setas movem e Enter abre.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void exportCsv()}>
            Exportar CSV
          </Button>
          <Button asChild>
            <Link to="/equipment/new" state={listState()} aria-keyshortcuts="Alt+N">
              Novo equipamento
              <ShortcutHint keys="Alt N" />
            </Link>
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
                <Link to="/equipment/new" state={listState()} aria-keyshortcuts="Alt+N">
                  Novo equipamento
                  <ShortcutHint keys="Alt N" />
                </Link>
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
                <TableHead className="sticky right-0 z-10 w-12 bg-white shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)] lg:static lg:shadow-none" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow
                  key={item.id}
                  ref={(node) => {
                    rowRefs.current[index] = node
                  }}
                  tabIndex={0}
                  className="group cursor-pointer focus-visible:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                  aria-label={`Abrir ${item.name}`}
                  onClick={() => navigate(`/equipment/${item.id}`, { state: listState() })}
                  onKeyDown={(event) => onRowKeyDown(event, index)}
                >
                  <TableCell className="font-medium">{item.assetTag}</TableCell>
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
                  <TableCell
                    className="sticky right-0 z-10 bg-white group-hover:bg-zinc-50 group-focus-visible:bg-muted shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)] lg:static lg:shadow-none"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-11 lg:size-8"
                          aria-label={`Ações de ${item.name}`}
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="min-h-11 lg:min-h-0"
                          onClick={() => navigate(`/equipment/${item.id}`, { state: listState() })}
                        >
                          Abrir
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="min-h-11 lg:min-h-0"
                          onClick={() =>
                            navigate(`/equipment/${item.id}/edit`, { state: listState() })
                          }
                        >
                          Editar
                        </DropdownMenuItem>
                        {item.status === 'in_stock' && (
                          <DropdownMenuItem
                            className="min-h-11 lg:min-h-0"
                            onClick={() => void putInUse(item)}
                          >
                            Colocar em uso
                          </DropdownMenuItem>
                        )}
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
