export type StatusEquipamento = 'em_uso' | 'em_estoque' | 'em_manutencao' | 'baixado'
export type TipoManutencao = 'preventiva' | 'corretiva'
export type SituacaoManutencao = 'aberta' | 'concluida' | 'cancelada'

export type Categoria = {
  id: number
  nome: string
  descricao: string | null
  ativo: boolean
  equipamentosCount: number
  createdAt: string
  updatedAt: string
}

export type Setor = {
  id: number
  nome: string
  descricao: string | null
  ativo: boolean
  equipamentosCount: number
  createdAt: string
  updatedAt: string
}

export type EquipamentoListItem = {
  id: number
  tombamento: string
  nome: string
  descricao: string | null
  categoriaId: number
  categoriaNome: string
  categoriaAtivo: boolean
  setorId: number
  setorNome: string
  setorAtivo: boolean
  complementoLocal: string | null
  marca: string | null
  modelo: string | null
  numeroSerie: string | null
  status: StatusEquipamento
  dataAquisicao: string | null
  valorAquisicaoCentavos: number | null
  fornecedor: string | null
  notaFiscal: string | null
  garantiaAte: string | null
  observacoes: string | null
  motivoBaixa: string | null
  dataBaixa: string | null
  createdAt: string
  updatedAt: string
}

export type Movimentacao = {
  id: number
  equipamentoId: number
  setorOrigemId: number | null
  setorOrigemNome: string | null
  setorDestinoId: number
  setorDestinoNome: string
  complementoOrigem: string | null
  complementoDestino: string | null
  motivo: string
  dataMovimentacao: string
  createdAt: string
}

export type Manutencao = {
  id: number
  equipamentoId: number
  equipamentoNome?: string
  equipamentoTombamento?: string
  tipo: TipoManutencao
  situacao: SituacaoManutencao
  dataAbertura: string
  dataConclusao: string | null
  descricaoProblema: string
  solucao: string | null
  custoCentavos: number | null
  fornecedorAssistencia: string | null
  motivoCancelamento: string | null
  statusAnterior: StatusEquipamento
  statusEquipamentoApos: 'em_uso' | 'em_estoque' | 'baixado' | null
  createdAt: string
  updatedAt: string
}

export type EquipamentoDetalhe = EquipamentoListItem & {
  movimentacoes: Movimentacao[]
  manutencoes: Manutencao[]
  temManutencaoAberta: boolean
}

export type Paginated<T> = {
  items: T[]
  total: number
}

export type PainelData = {
  ativos: number
  emUso: number
  emEstoque: number
  emManutencao: number
  baixados: number
  valorTotalCentavos: number
  garantiasVencidas: EquipamentoListItem[]
  garantiasAVencer: EquipamentoListItem[]
  manutencoesAbertas: Manutencao[]
  ultimasMovimentacoes: Array<Movimentacao & {
    equipamentoNome: string
    equipamentoTombamento: string
  }>
}

export const STATUS_LABELS: Record<StatusEquipamento, string> = {
  em_uso: 'Em uso',
  em_estoque: 'Em estoque',
  em_manutencao: 'Em manutenção',
  baixado: 'Baixado',
}

export const TIPO_MANUTENCAO_LABELS: Record<TipoManutencao, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
}

export const SITUACAO_MANUTENCAO_LABELS: Record<SituacaoManutencao, string> = {
  aberta: 'Aberta',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}
