import { todayLocal } from '@/lib/dates'
import type { EquipamentoListItem, Manutencao, PainelData, StatusEquipamento } from '@/lib/types'
import { wrapDb } from './errors'
import { getDb } from './sqlite'

type EquipRow = {
  id: number
  tombamento: string
  nome: string
  descricao: string | null
  categoria_id: number
  categoria_nome: string
  categoria_ativo: number
  setor_id: number
  setor_nome: string
  setor_ativo: number
  complemento_local: string | null
  marca: string | null
  modelo: string | null
  numero_serie: string | null
  status: StatusEquipamento
  data_aquisicao: string | null
  valor_aquisicao_centavos: number | null
  fornecedor: string | null
  nota_fiscal: string | null
  garantia_ate: string | null
  observacoes: string | null
  motivo_baixa: string | null
  data_baixa: string | null
  created_at: string
  updated_at: string
}

function mapEquip(r: EquipRow): EquipamentoListItem {
  return {
    id: r.id,
    tombamento: r.tombamento,
    nome: r.nome,
    descricao: r.descricao,
    categoriaId: r.categoria_id,
    categoriaNome: r.categoria_nome,
    categoriaAtivo: r.categoria_ativo === 1,
    setorId: r.setor_id,
    setorNome: r.setor_nome,
    setorAtivo: r.setor_ativo === 1,
    complementoLocal: r.complemento_local,
    marca: r.marca,
    modelo: r.modelo,
    numeroSerie: r.numero_serie,
    status: r.status,
    dataAquisicao: r.data_aquisicao,
    valorAquisicaoCentavos: r.valor_aquisicao_centavos,
    fornecedor: r.fornecedor,
    notaFiscal: r.nota_fiscal,
    garantiaAte: r.garantia_ate,
    observacoes: r.observacoes,
    motivoBaixa: r.motivo_baixa,
    dataBaixa: r.data_baixa,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const EQUIP_SELECT = `
  SELECT e.*,
    c.nome AS categoria_nome,
    c.ativo AS categoria_ativo,
    s.nome AS setor_nome,
    s.ativo AS setor_ativo
  FROM equipamentos e
  JOIN categorias c ON c.id = e.categoria_id
  JOIN setores s ON s.id = e.setor_id
`

export function dashboard(): PainelData {
  return wrapDb(() => {
    const db = getDb()
    const today = todayLocal()
    const in30 = (() => {
      const d = new Date(`${today}T12:00:00`)
      d.setDate(d.getDate() + 30)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    })()

    const counts = db
      .query<{
        ativos: number
        em_uso: number
        em_estoque: number
        em_manutencao: number
        baixados: number
        valor_total: number | null
      }, []>(
        `SELECT
          SUM(CASE WHEN status <> 'baixado' THEN 1 ELSE 0 END) AS ativos,
          SUM(CASE WHEN status = 'em_uso' THEN 1 ELSE 0 END) AS em_uso,
          SUM(CASE WHEN status = 'em_estoque' THEN 1 ELSE 0 END) AS em_estoque,
          SUM(CASE WHEN status = 'em_manutencao' THEN 1 ELSE 0 END) AS em_manutencao,
          SUM(CASE WHEN status = 'baixado' THEN 1 ELSE 0 END) AS baixados,
          SUM(CASE WHEN status <> 'baixado' THEN ifnull(valor_aquisicao_centavos, 0) ELSE 0 END) AS valor_total
         FROM equipamentos`,
      )
      .get()

    const garantiasVencidas = db
      .query<EquipRow, [string]>(
        `${EQUIP_SELECT}
         WHERE e.status <> 'baixado'
           AND e.garantia_ate IS NOT NULL
           AND e.garantia_ate < ?
         ORDER BY e.garantia_ate ASC
         LIMIT 10`,
      )
      .all(today)
      .map(mapEquip)

    const garantiasAVencer = db
      .query<EquipRow, [string, string]>(
        `${EQUIP_SELECT}
         WHERE e.status <> 'baixado'
           AND e.garantia_ate IS NOT NULL
           AND e.garantia_ate >= ?
           AND e.garantia_ate <= ?
         ORDER BY e.garantia_ate ASC
         LIMIT 10`,
      )
      .all(today, in30)
      .map(mapEquip)

    const manutencoesAbertas = db
      .query<
        {
          id: number
          equipamento_id: number
          equipamento_nome: string
          equipamento_tombamento: string
          tipo: Manutencao['tipo']
          situacao: Manutencao['situacao']
          data_abertura: string
          data_conclusao: string | null
          descricao_problema: string
          solucao: string | null
          custo_centavos: number | null
          fornecedor_assistencia: string | null
          motivo_cancelamento: string | null
          status_anterior: StatusEquipamento
          status_equipamento_apos: Manutencao['statusEquipamentoApos']
          created_at: string
          updated_at: string
        },
        []
      >(
        `SELECT m.*,
          e.nome AS equipamento_nome,
          e.tombamento AS equipamento_tombamento
         FROM manutencoes m
         JOIN equipamentos e ON e.id = m.equipamento_id
         WHERE m.situacao = 'aberta'
         ORDER BY m.data_abertura DESC, m.id DESC`,
      )
      .all()
      .map((r) => ({
        id: r.id,
        equipamentoId: r.equipamento_id,
        equipamentoNome: r.equipamento_nome,
        equipamentoTombamento: r.equipamento_tombamento,
        tipo: r.tipo,
        situacao: r.situacao,
        dataAbertura: r.data_abertura,
        dataConclusao: r.data_conclusao,
        descricaoProblema: r.descricao_problema,
        solucao: r.solucao,
        custoCentavos: r.custo_centavos,
        fornecedorAssistencia: r.fornecedor_assistencia,
        motivoCancelamento: r.motivo_cancelamento,
        statusAnterior: r.status_anterior,
        statusEquipamentoApos: r.status_equipamento_apos,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }))

    const ultimasMovimentacoes = db
      .query<
        {
          id: number
          equipamento_id: number
          equipamento_nome: string
          equipamento_tombamento: string
          setor_origem_id: number | null
          setor_origem_nome: string | null
          setor_destino_id: number
          setor_destino_nome: string
          complemento_origem: string | null
          complemento_destino: string | null
          motivo: string
          data_movimentacao: string
          created_at: string
        },
        []
      >(
        `SELECT m.*,
          e.nome AS equipamento_nome,
          e.tombamento AS equipamento_tombamento,
          so.nome AS setor_origem_nome,
          sd.nome AS setor_destino_nome
         FROM movimentacoes m
         JOIN equipamentos e ON e.id = m.equipamento_id
         LEFT JOIN setores so ON so.id = m.setor_origem_id
         JOIN setores sd ON sd.id = m.setor_destino_id
         ORDER BY m.data_movimentacao DESC, m.id DESC
         LIMIT 8`,
      )
      .all()
      .map((r) => ({
        id: r.id,
        equipamentoId: r.equipamento_id,
        equipamentoNome: r.equipamento_nome,
        equipamentoTombamento: r.equipamento_tombamento,
        setorOrigemId: r.setor_origem_id,
        setorOrigemNome: r.setor_origem_nome,
        setorDestinoId: r.setor_destino_id,
        setorDestinoNome: r.setor_destino_nome,
        complementoOrigem: r.complemento_origem,
        complementoDestino: r.complemento_destino,
        motivo: r.motivo,
        dataMovimentacao: r.data_movimentacao,
        createdAt: r.created_at,
      }))

    return {
      ativos: counts?.ativos ?? 0,
      emUso: counts?.em_uso ?? 0,
      emEstoque: counts?.em_estoque ?? 0,
      emManutencao: counts?.em_manutencao ?? 0,
      baixados: counts?.baixados ?? 0,
      valorTotalCentavos: counts?.valor_total ?? 0,
      garantiasVencidas,
      garantiasAVencer,
      manutencoesAbertas,
      ultimasMovimentacoes,
    }
  })
}
