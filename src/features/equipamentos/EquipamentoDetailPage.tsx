import { GarantiaBadge } from '@/components/GarantiaBadge'
import { ManutencaoRegularBadge } from '@/components/ManutencaoRegularBadge'
import { SituacaoBadge, StatusBadge } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AbrirManutencaoDialog,
  CancelarManutencaoDialog,
  ConcluirManutencaoDialog,
} from '@/features/manutencoes/ManutencaoDialogs'
import { api } from '@/lib/api'
import { formatDatePt } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import type { EquipamentoDetalhe, Manutencao } from '@/lib/types'
import { TIPO_MANUTENCAO_LABELS } from '@/lib/types'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BaixarDialog } from './BaixarDialog'
import { ExcluirDialog } from './ExcluirDialog'
import { TransferirDialog } from './TransferirDialog'

export function EquipamentoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [equip, setEquip] = useState<EquipamentoDetalhe | null>(null)
  const [transferir, setTransferir] = useState(false)
  const [baixar, setBaixar] = useState(false)
  const [excluir, setExcluir] = useState(false)
  const [abrirManut, setAbrirManut] = useState(false)
  const [concluir, setConcluir] = useState<Manutencao | null>(null)
  const [cancelar, setCancelar] = useState<Manutencao | null>(null)

  async function load() {
    if (!id) return
    try {
      setEquip(await api.getEquipamento(Number(id)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  async function reativar() {
    if (!equip) return
    if (!window.confirm('O status volta para Em estoque.')) return
    try {
      await api.reativar(equip.id)
      toast.success('Equipamento reativado')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  if (!equip) return <p className="text-muted-foreground">Carregando…</p>

  const baixado = equip.status === 'baixado'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">{equip.nome}</h2>
            <StatusBadge status={equip.status} />
          </div>
          <p className="text-muted-foreground">{equip.tombamento}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/equipamentos/${equip.id}/editar`}>Editar</Link>
          </Button>
          {!baixado && (
            <>
              <Button variant="outline" onClick={() => setTransferir(true)}>
                Transferir
              </Button>
              <Button variant="outline" onClick={() => setAbrirManut(true)}>
                Nova manutenção
              </Button>
              <Button variant="outline" onClick={() => setBaixar(true)}>
                Baixar
              </Button>
            </>
          )}
          {baixado && (
            <Button variant="outline" onClick={() => void reativar()}>
              Reativar
            </Button>
          )}
          <Button variant="destructive" onClick={() => setExcluir(true)}>
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados cadastrais</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <Info label="Categoria" value={equip.categoriaNome} inactive={!equip.categoriaAtivo} />
            <Info label="Marca" value={equip.marca} />
            <Info label="Modelo" value={equip.modelo} />
            <Info label="Número de série" value={equip.numeroSerie} />
            <Info label="Aquisição" value={formatDatePt(equip.dataAquisicao)} />
            <Info label="Valor" value={formatBRL(equip.valorAquisicaoCentavos)} />
            <Info label="Fornecedor" value={equip.fornecedor} />
            <Info label="Nota fiscal" value={equip.notaFiscal} />
            <div className="sm:col-span-2">
              <Info label="Descrição" value={equip.descricao} />
            </div>
            <div className="sm:col-span-2">
              <Info label="Observações" value={equip.observacoes} />
            </div>
            {baixado && (
              <>
                <Info label="Data da baixa" value={formatDatePt(equip.dataBaixa)} />
                <Info label="Motivo da baixa" value={equip.motivoBaixa} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Localização e garantia</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <Info label="Setor" value={equip.setorNome} inactive={!equip.setorAtivo} />
            <Info label="Localização" value={equip.complementoLocal} />
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Garantia</span>
              <GarantiaBadge garantiaAte={equip.garantiaAte} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Manutenção regular</span>
              <ManutencaoRegularBadge
                intervaloDias={
                  equip.categoriaManutencaoRegular ? equip.categoriaIntervaloManutencaoDias : null
                }
                cadastradoEm={equip.createdAt}
                ultimaConclusao={equip.ultimaManutencaoConclusao}
                baixado={equip.status === 'baixado'}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movimentações</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equip.movimentacoes.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDatePt(m.dataMovimentacao)}</TableCell>
                  <TableCell>
                    {m.setorOrigemNome ?? 'Cadastro'}
                    {m.complementoOrigem ? ` · ${m.complementoOrigem}` : ''}
                  </TableCell>
                  <TableCell>
                    {m.setorDestinoNome}
                    {m.complementoDestino ? ` · ${m.complementoDestino}` : ''}
                  </TableCell>
                  <TableCell>{m.motivo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manutenções</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Abertura</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Problema</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {equip.manutencoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Nenhuma manutenção.
                  </TableCell>
                </TableRow>
              ) : (
                equip.manutencoes.map((m) => (
                  <TableRow key={m.id}>
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
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransferirDialog
        open={transferir}
        onOpenChange={setTransferir}
        equipamento={equip}
        onDone={() => void load()}
      />
      <BaixarDialog
        open={baixar}
        onOpenChange={setBaixar}
        equipamento={equip}
        onDone={() => void load()}
      />
      <ExcluirDialog
        open={excluir}
        onOpenChange={setExcluir}
        equipamento={equip}
        onDone={() => navigate('/equipamentos')}
      />
      <AbrirManutencaoDialog
        open={abrirManut}
        onOpenChange={setAbrirManut}
        equipamentoId={equip.id}
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

function Info({
  label,
  value,
  inactive,
}: {
  label: string
  value: string | null | undefined
  inactive?: boolean
}) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div>
        {value || '—'}
        {inactive && (
          <Badge variant="outline" className="ml-2">
            Inativo
          </Badge>
        )}
      </div>
    </div>
  )
}
