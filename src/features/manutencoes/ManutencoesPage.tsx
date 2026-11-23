import { EmptyState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { SituacaoBadge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
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
import { formatDatePt } from '@/lib/dates'
import type { Manutencao, SituacaoManutencao, TipoManutencao } from '@/lib/types'
import { TIPO_MANUTENCAO_LABELS } from '@/lib/types'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  AbrirManutencaoDialog,
  CancelarManutencaoDialog,
  ConcluirManutencaoDialog,
} from './ManutencaoDialogs'

export function ManutencoesPage() {
  const [items, setItems] = useState<Manutencao[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [situacao, setSituacao] = useState<string>('all')
  const [tipo, setTipo] = useState<string>('all')
  const [qInput, setQInput] = useState('')
  const [q, setQ] = useState('')
  const [abrir, setAbrir] = useState(false)
  const [concluir, setConcluir] = useState<Manutencao | null>(null)
  const [cancelar, setCancelar] = useState<Manutencao | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [qInput])

  async function load() {
    try {
      const r = await api.listManutencoes({
        situacao: situacao === 'all' ? undefined : (situacao as SituacaoManutencao),
        tipo: tipo === 'all' ? undefined : (tipo as TipoManutencao),
        q: q || undefined,
        page,
        pageSize: 20,
      })
      setItems(r.items)
      setTotal(r.total)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  useEffect(() => {
    void load()
  }, [situacao, tipo, q, page])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Manutenções</h2>
          <p className="text-muted-foreground">Histórico e ordens em aberto</p>
        </div>
        <Button onClick={() => setAbrir(true)}>Nova manutenção</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Buscar por nome ou tombamento…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />
        <Select value={situacao} onValueChange={(v) => { setSituacao(v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="aberta">Aberta</SelectItem>
            <SelectItem value="concluida">Concluída</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tipo} onValueChange={(v) => { setTipo(v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="corretiva">Corretiva</SelectItem>
            <SelectItem value="preventiva">Preventiva</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <EmptyState title="Nenhuma manutenção encontrada" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipamento</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link
                      className="hover:underline"
                      to={`/equipamentos/${m.equipamentoId}`}
                    >
                      {m.equipamentoTombamento} · {m.equipamentoNome}
                    </Link>
                  </TableCell>
                  <TableCell>{formatDatePt(m.dataAbertura)}</TableCell>
                  <TableCell>{TIPO_MANUTENCAO_LABELS[m.tipo]}</TableCell>
                  <TableCell>
                    <SituacaoBadge situacao={m.situacao} />
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{m.descricaoProblema}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    {m.situacao === 'aberta' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setConcluir(m)}>
                          Concluir
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setCancelar(m)}>
                          Cancelar
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={20} total={total} onPageChange={setPage} />
        </>
      )}

      <AbrirManutencaoDialog
        open={abrir}
        onOpenChange={setAbrir}
        onDone={() => void load()}
      />
      <ConcluirManutencaoDialog
        open={Boolean(concluir)}
        onOpenChange={(v) => !v && setConcluir(null)}
        manutencao={concluir}
        onDone={() => void load()}
      />
      <CancelarManutencaoDialog
        open={Boolean(cancelar)}
        onOpenChange={(v) => !v && setCancelar(null)}
        manutencao={cancelar}
        onDone={() => void load()}
      />
    </div>
  )
}
