import { isBefore, isFutureDate } from '@/lib/dates'
import type {
  AbrirManutencaoInput,
  CancelarManutencaoInput,
  ConcluirManutencaoInput,
} from '@/lib/schemas'
import type {
  Manutencao,
  Paginated,
  SituacaoManutencao,
  StatusEquipamento,
  TipoManutencao,
} from '@/lib/types'
import { AppError, wrapDb } from './errors'
import { getEquipamento } from './equipamentos'
import { getDb, nullIfEmpty } from './sqlite'

type Row = {
  id: number
  equipamento_id: number
  equipamento_nome: string
  equipamento_tombamento: string
  tipo: TipoManutencao
  situacao: SituacaoManutencao
  data_abertura: string
  data_conclusao: string | null
  descricao_problema: string
  solucao: string | null
  custo_centavos: number | null
  fornecedor_assistencia: string | null
  motivo_cancelamento: string | null
  status_anterior: StatusEquipamento
  status_equipamento_apos: 'em_uso' | 'em_estoque' | 'baixado' | null
  created_at: string
  updated_at: string
}

function mapRow(r: Row): Manutencao {
  return {
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
  }
}

export type ListManutencoesParams = {
  situacao?: SituacaoManutencao
  tipo?: TipoManutencao
  equipamentoId?: number
  q?: string
  page?: number
  pageSize?: number
}

export function listManutencoes(
  params: ListManutencoesParams = {},
): Paginated<Manutencao> {
  return wrapDb(() => {
    const db = getDb()
    const page = Math.max(1, params.page ?? 1)
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 10_000)
    const offset = (page - 1) * pageSize

    const where: string[] = []
    const args: Array<string | number> = []

    if (params.situacao) {
      where.push('m.situacao = ?')
      args.push(params.situacao)
    }
    if (params.tipo) {
      where.push('m.tipo = ?')
      args.push(params.tipo)
    }
    if (params.equipamentoId) {
      where.push('m.equipamento_id = ?')
      args.push(params.equipamentoId)
    }
    if (params.q?.trim()) {
      const like = `%${params.q.trim().toLowerCase()}%`
      where.push('(lower(e.nome) LIKE ? OR lower(e.tombamento) LIKE ?)')
      args.push(like, like)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const total =
      db
        .query<{ c: number }, Array<string | number>>(
          `SELECT COUNT(*) AS c
           FROM manutencoes m
           JOIN equipamentos e ON e.id = m.equipamento_id
           ${whereSql}`,
        )
        .get(...args)?.c ?? 0

    const rows = db
      .query<Row, Array<string | number>>(
        `SELECT m.*,
          e.nome AS equipamento_nome,
          e.tombamento AS equipamento_tombamento
         FROM manutencoes m
         JOIN equipamentos e ON e.id = m.equipamento_id
         ${whereSql}
         ORDER BY m.data_abertura DESC, m.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, offset)

    return { items: rows.map(mapRow), total }
  })
}

function getManutencao(id: number): Manutencao {
  const db = getDb()
  const row = db
    .query<Row, [number]>(
      `SELECT m.*,
        e.nome AS equipamento_nome,
        e.tombamento AS equipamento_tombamento
       FROM manutencoes m
       JOIN equipamentos e ON e.id = m.equipamento_id
       WHERE m.id = ?`,
    )
    .get(id)
  if (!row) throw new AppError('Manutenção não encontrada.')
  return mapRow(row)
}

export function abrirManutencao(input: AbrirManutencaoInput): Manutencao {
  return wrapDb(() => {
    const db = getDb()
    const equip = getEquipamento(input.equipamentoId)
    if (equip.status === 'baixado') {
      throw new AppError('Equipamento baixado não pode abrir manutenção.')
    }
    if (equip.temManutencaoAberta) {
      throw new AppError('Este equipamento já possui uma manutenção aberta.')
    }
    if (isFutureDate(input.dataAbertura)) {
      throw new AppError('Data de abertura não pode ser futura.')
    }

    const tx = db.transaction(() => {
      const result = db
        .query(
          `INSERT INTO manutencoes (
            equipamento_id, tipo, situacao, data_abertura, descricao_problema,
            custo_centavos, fornecedor_assistencia, status_anterior,
            created_at, updated_at
          ) VALUES (?, ?, 'aberta', ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
        )
        .run(
          input.equipamentoId,
          input.tipo,
          input.dataAbertura,
          input.descricaoProblema.trim(),
          input.custoCentavos ?? null,
          nullIfEmpty(input.fornecedorAssistencia),
          equip.status,
        )
      db.query(
        `UPDATE equipamentos
         SET status = 'em_manutencao', updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(input.equipamentoId)
      return Number(result.lastInsertRowid)
    })

    return getManutencao(tx())
  })
}

export function concluirManutencao(
  id: number,
  input: ConcluirManutencaoInput,
): Manutencao {
  return wrapDb(() => {
    const db = getDb()
    const manut = getManutencao(id)
    if (manut.situacao !== 'aberta') {
      throw new AppError('Somente manutenções abertas podem ser concluídas.')
    }
    if (isFutureDate(input.dataConclusao)) {
      throw new AppError('Data de conclusão não pode ser futura.')
    }
    if (isBefore(input.dataConclusao, manut.dataAbertura)) {
      throw new AppError('Conclusão não pode ser anterior à abertura.')
    }

    let motivoBaixa: string | null = null
    if (input.statusEquipamentoApos === 'baixado') {
      const m = (input.motivoBaixa ?? '').trim()
      if (m.length < 3) {
        throw new AppError('Informe o motivo da baixa (mínimo 3 caracteres).')
      }
      motivoBaixa = m
    }

    const tx = db.transaction(() => {
      db.query(
        `UPDATE manutencoes SET
          situacao = 'concluida',
          data_conclusao = ?,
          solucao = ?,
          custo_centavos = ?,
          fornecedor_assistencia = ?,
          status_equipamento_apos = ?,
          updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(
        input.dataConclusao,
        input.solucao.trim(),
        input.custoCentavos ?? null,
        nullIfEmpty(input.fornecedorAssistencia),
        input.statusEquipamentoApos,
        id,
      )

      if (input.statusEquipamentoApos === 'baixado') {
        db.query(
          `UPDATE equipamentos SET
            status = 'baixado',
            motivo_baixa = ?,
            data_baixa = ?,
            updated_at = datetime('now','localtime')
           WHERE id = ?`,
        ).run(motivoBaixa, input.dataConclusao, manut.equipamentoId)
      } else {
        db.query(
          `UPDATE equipamentos SET
            status = ?,
            updated_at = datetime('now','localtime')
           WHERE id = ?`,
        ).run(input.statusEquipamentoApos, manut.equipamentoId)
      }
    })
    tx()
    return getManutencao(id)
  })
}

export function cancelarManutencao(
  id: number,
  input: CancelarManutencaoInput,
): Manutencao {
  return wrapDb(() => {
    const db = getDb()
    const manut = getManutencao(id)
    if (manut.situacao !== 'aberta') {
      throw new AppError('Somente manutenções abertas podem ser canceladas.')
    }

    const statusVolta =
      manut.statusAnterior === 'em_manutencao' ? 'em_uso' : manut.statusAnterior

    const tx = db.transaction(() => {
      db.query(
        `UPDATE manutencoes SET
          situacao = 'cancelada',
          motivo_cancelamento = ?,
          updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(input.motivoCancelamento.trim(), id)
      db.query(
        `UPDATE equipamentos SET
          status = ?,
          updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(statusVolta, manut.equipamentoId)
    })
    tx()
    return getManutencao(id)
  })
}
