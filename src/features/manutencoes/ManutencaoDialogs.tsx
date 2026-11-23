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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { todayLocal } from '@/lib/dates'
import { parseBRLToCentavos } from '@/lib/money'
import type { EquipamentoListItem, Manutencao } from '@/lib/types'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

export function AbrirManutencaoDialog({
  open,
  onOpenChange,
  equipamentoId,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  equipamentoId?: number
  onDone: () => void
}) {
  const [equipamentos, setEquipamentos] = useState<EquipamentoListItem[]>([])
  const [busca, setBusca] = useState('')
  const [selectedId, setSelectedId] = useState(equipamentoId ? String(equipamentoId) : '')
  const [tipo, setTipo] = useState<'corretiva' | 'preventiva'>('corretiva')
  const [dataAbertura, setDataAbertura] = useState(todayLocal())
  const [problema, setProblema] = useState('')
  const [custo, setCusto] = useState('')
  const [assistencia, setAssistencia] = useState('')

  useEffect(() => {
    if (!open) return
    setTipo('corretiva')
    setDataAbertura(todayLocal())
    setProblema('')
    setCusto('')
    setAssistencia('')
    setSelectedId(equipamentoId ? String(equipamentoId) : '')
    setBusca('')
    if (!equipamentoId) {
      api
        .listEquipamentos({ pageSize: 0 })
        .then((r) => setEquipamentos(r.items.filter((e) => e.status !== 'baixado')))
        .catch((e) => toast.error(e.message))
    }
  }, [open, equipamentoId])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return equipamentos.slice(0, 50)
    return equipamentos
      .filter(
        (e) =>
          e.nome.toLowerCase().includes(q) ||
          e.tombamento.toLowerCase().includes(q),
      )
      .slice(0, 50)
  }, [equipamentos, busca])

  async function submit() {
    try {
      let custoCentavos: number | null = null
      try {
        custoCentavos = parseBRLToCentavos(custo)
      } catch {
        toast.error('Custo inválido')
        return
      }
      await api.abrirManutencao({
        equipamentoId: Number(selectedId),
        tipo,
        dataAbertura,
        descricaoProblema: problema,
        custoCentavos,
        fornecedorAssistencia: assistencia,
      })
      toast.success('Manutenção aberta')
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova manutenção</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {!equipamentoId && (
            <>
              <div className="space-y-1">
                <Label>Buscar equipamento</Label>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Equipamento</Label>
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {filtrados.map((e) => (
                      <SelectItem key={e.id} value={String(e.id)}>
                        {e.tombamento} · {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-1">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="corretiva">Corretiva</SelectItem>
                <SelectItem value="preventiva">Preventiva</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Data de abertura</Label>
            <Input
              type="date"
              value={dataAbertura}
              onChange={(e) => setDataAbertura(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Problema</Label>
            <Textarea value={problema} onChange={(e) => setProblema(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Custo (R$)</Label>
            <Input value={custo} onChange={(e) => setCusto(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Assistência</Label>
            <Input value={assistencia} onChange={(e) => setAssistencia(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()}>Abrir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ConcluirManutencaoDialog({
  open,
  onOpenChange,
  manutencao,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  manutencao: Manutencao | null
  onDone: () => void
}) {
  const [data, setData] = useState(todayLocal())
  const [solucao, setSolucao] = useState('')
  const [custo, setCusto] = useState('')
  const [assistencia, setAssistencia] = useState('')
  const [statusApos, setStatusApos] = useState<'em_uso' | 'em_estoque' | 'baixado'>('em_uso')
  const [motivoBaixa, setMotivoBaixa] = useState('')

  useEffect(() => {
    if (!open || !manutencao) return
    setData(todayLocal())
    setSolucao('')
    setCusto(
      manutencao.custoCentavos != null
        ? (manutencao.custoCentavos / 100).toFixed(2).replace('.', ',')
        : '',
    )
    setAssistencia(manutencao.fornecedorAssistencia ?? '')
    setStatusApos('em_uso')
    setMotivoBaixa('')
  }, [open, manutencao])

  async function submit() {
    if (!manutencao) return
    try {
      let custoCentavos: number | null = null
      try {
        custoCentavos = parseBRLToCentavos(custo)
      } catch {
        toast.error('Custo inválido')
        return
      }
      await api.concluirManutencao(manutencao.id, {
        dataConclusao: data,
        solucao,
        custoCentavos,
        fornecedorAssistencia: assistencia,
        statusEquipamentoApos: statusApos,
        motivoBaixa: statusApos === 'baixado' ? motivoBaixa : null,
      })
      toast.success('Manutenção concluída')
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Concluir manutenção</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Data de conclusão</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Solução</Label>
            <Textarea value={solucao} onChange={(e) => setSolucao(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Custo (R$)</Label>
            <Input value={custo} onChange={(e) => setCusto(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Assistência</Label>
            <Input value={assistencia} onChange={(e) => setAssistencia(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Status seguinte</Label>
            <Select
              value={statusApos}
              onValueChange={(v) => setStatusApos(v as typeof statusApos)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="em_uso">Em uso</SelectItem>
                <SelectItem value="em_estoque">Em estoque</SelectItem>
                <SelectItem value="baixado">Baixado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {statusApos === 'baixado' && (
            <div className="space-y-1">
              <Label>Motivo da baixa</Label>
              <Textarea
                value={motivoBaixa}
                onChange={(e) => setMotivoBaixa(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void submit()}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CancelarManutencaoDialog({
  open,
  onOpenChange,
  manutencao,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  manutencao: Manutencao | null
  onDone: () => void
}) {
  const [motivo, setMotivo] = useState('')

  useEffect(() => {
    if (open) setMotivo('')
  }, [open])

  async function submit() {
    if (!manutencao) return
    try {
      await api.cancelarManutencao(manutencao.id, { motivoCancelamento: motivo })
      toast.success('Manutenção cancelada')
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancelar manutenção</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label>Motivo</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={() => void submit()}>
            Cancelar manutenção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
