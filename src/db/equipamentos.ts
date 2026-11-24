import { isBefore, isFutureDate, todayLocal } from '@/lib/dates'
import type {
  BaixarInput,
  CreateEquipamentoInput,
  TransferirInput,
  UpdateEquipamentoInput,
} from '@/lib/schemas'
import type {
  EquipamentoDetalhe,
  EquipamentoListItem,
  Manutencao,
  Movimentacao,
  Paginated,
  StatusEquipamento,
} from '@/lib/types'
import { AppError, wrapDb } from './errors'
import { getDb, nullIfEmpty } from './sqlite'

type EquipRow = {
  id: number
  tombamento: string
  nome: string
  descricao: string | null
  categoria_id: number
  categoria_nome: string
  categoria_ativo: number
  categoria_manutencao_regular: number
  categoria_intervalo_manutencao_dias: number | null
  ultima_manutencao_conclusao: string | null
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

const EQUIP_SELECT = `
  SELECT e.*,
    c.nome AS categoria_nome,
    c.ativo AS categoria_ativo,
    c.manutencao_regular AS categoria_manutencao_regular,
    c.intervalo_manutencao_dias AS categoria_intervalo_manutencao_dias,
    (
      SELECT MAX(m.data_conclusao)
      FROM manutencoes m
      WHERE m.equipamento_id = e.id AND m.situacao = 'concluida'
    ) AS ultima_manutencao_conclusao,
    s.nome AS setor_nome,
    s.ativo AS setor_ativo
  FROM equipamentos e
  JOIN categorias c ON c.id = e.categoria_id
  JOIN setores s ON s.id = e.setor_id
`

function mapEquip(r: EquipRow): EquipamentoListItem {
  return {
    id: r.id,
    tombamento: r.tombamento,
    nome: r.nome,
    descricao: r.descricao,
    categoriaId: r.categoria_id,
    categoriaNome: r.categoria_nome,
    categoriaAtivo: r.categoria_ativo === 1,
    categoriaManutencaoRegular: r.categoria_manutencao_regular === 1,
    categoriaIntervaloManutencaoDias: r.categoria_intervalo_manutencao_dias,
    ultimaManutencaoConclusao: r.ultima_manutencao_conclusao,
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

function assertNotFuture(date: string, label: string) {
  if (isFutureDate(date)) {
    throw new AppError(`${label} não pode ser futura.`)
  }
}

export function nextTombamento(): string {
  return wrapDb(() => {
    const db = getDb()
    const rows = db
      .query<{ tombamento: string }, []>(
        `SELECT tombamento FROM equipamentos
         WHERE tombamento GLOB 'PAT-[0-9]*'`,
      )
      .all()
    let max = 0
    for (const r of rows) {
      const m = /^PAT-(\d+)$/i.exec(r.tombamento)
      if (m) max = Math.max(max, Number(m[1]))
    }
    return `PAT-${String(max + 1).padStart(6, '0')}`
  })
}

export type ListEquipamentosParams = {
  q?: string
  categoriaId?: number
  setorId?: number
  status?: StatusEquipamento
  sort?: 'tombamento' | 'nome' | 'status'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export function listEquipamentos(
  params: ListEquipamentosParams = {},
): Paginated<EquipamentoListItem> {
  return wrapDb(() => {
    const db = getDb()
    const page = Math.max(1, params.page ?? 1)
    let pageSize = params.pageSize ?? 20
    if (pageSize === 0) pageSize = 10_000
    pageSize = Math.min(Math.max(pageSize, 1), 10_000)
    const offset = (page - 1) * pageSize

    const where: string[] = []
    const args: Array<string | number> = []

    if (params.q?.trim()) {
      const like = `%${params.q.trim().toLowerCase()}%`
      where.push(`(
        lower(e.tombamento) LIKE ? OR lower(e.nome) LIKE ? OR
        lower(ifnull(e.numero_serie,'')) LIKE ? OR lower(ifnull(e.marca,'')) LIKE ? OR
        lower(ifnull(e.modelo,'')) LIKE ? OR lower(ifnull(e.descricao,'')) LIKE ?
      )`)
      args.push(like, like, like, like, like, like)
    }
    if (params.categoriaId) {
      where.push('e.categoria_id = ?')
      args.push(params.categoriaId)
    }
    if (params.setorId) {
      where.push('e.setor_id = ?')
      args.push(params.setorId)
    }
    if (params.status) {
      where.push('e.status = ?')
      args.push(params.status)
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const sortCol =
      params.sort === 'nome'
        ? 'e.nome'
        : params.sort === 'status'
          ? 'e.status'
          : 'e.tombamento'
    const sortDir = params.order === 'asc' ? 'ASC' : 'DESC'

    const total =
      db
        .query<{ c: number }, Array<string | number>>(
          `SELECT COUNT(*) AS c FROM equipamentos e ${whereSql}`,
        )
        .get(...args)?.c ?? 0

    const rows = db
      .query<EquipRow, Array<string | number>>(
        `${EQUIP_SELECT} ${whereSql}
         ORDER BY ${sortCol} COLLATE NOCASE ${sortDir}, e.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...args, pageSize, offset)

    return { items: rows.map(mapEquip), total }
  })
}

function listMovimentacoes(equipamentoId: number): Movimentacao[] {
  const db = getDb()
  const rows = db
    .query<
      {
        id: number
        equipamento_id: number
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
      [number]
    >(
      `SELECT m.*,
        so.nome AS setor_origem_nome,
        sd.nome AS setor_destino_nome
       FROM movimentacoes m
       LEFT JOIN setores so ON so.id = m.setor_origem_id
       JOIN setores sd ON sd.id = m.setor_destino_id
       WHERE m.equipamento_id = ?
       ORDER BY m.data_movimentacao DESC, m.id DESC`,
    )
    .all(equipamentoId)

  return rows.map((r) => ({
    id: r.id,
    equipamentoId: r.equipamento_id,
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
}

function listManutencoesEquipamento(equipamentoId: number): Manutencao[] {
  const db = getDb()
  const rows = db
    .query<
      {
        id: number
        equipamento_id: number
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
      [number]
    >(
      `SELECT * FROM manutencoes
       WHERE equipamento_id = ?
       ORDER BY data_abertura DESC, id DESC`,
    )
    .all(equipamentoId)

  return rows.map((r) => ({
    id: r.id,
    equipamentoId: r.equipamento_id,
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
}

export function getEquipamento(id: number): EquipamentoDetalhe {
  return wrapDb(() => {
    const db = getDb()
    const row = db
      .query<EquipRow, [number]>(`${EQUIP_SELECT} WHERE e.id = ?`)
      .get(id)
    if (!row) throw new AppError('Equipamento não encontrado.')
    const manutencoes = listManutencoesEquipamento(id)
    return {
      ...mapEquip(row),
      movimentacoes: listMovimentacoes(id),
      manutencoes,
      temManutencaoAberta: manutencoes.some((m) => m.situacao === 'aberta'),
    }
  })
}

function assertCategoriaAtiva(id: number) {
  const db = getDb()
  const row = db
    .query<{ ativo: number }, [number]>('SELECT ativo FROM categorias WHERE id = ?')
    .get(id)
  if (!row) throw new AppError('Categoria não encontrada.')
  if (row.ativo !== 1) throw new AppError('Selecione uma categoria ativa.')
}

function assertSetorAtivo(id: number) {
  const db = getDb()
  const row = db
    .query<{ ativo: number }, [number]>('SELECT ativo FROM setores WHERE id = ?')
    .get(id)
  if (!row) throw new AppError('Setor não encontrado.')
  if (row.ativo !== 1) throw new AppError('Selecione um setor ativo.')
}

export function createEquipamento(input: CreateEquipamentoInput): EquipamentoDetalhe {
  return wrapDb(() => {
    const db = getDb()
    if (input.status !== 'em_estoque' && input.status !== 'em_uso') {
      throw new AppError('Cadastro só aceita status Em estoque ou Em uso.')
    }
    assertCategoriaAtiva(input.categoriaId)
    assertSetorAtivo(input.setorId)

    const dataMov =
      input.dataAquisicao && input.dataAquisicao.length > 0
        ? input.dataAquisicao
        : todayLocal()
    assertNotFuture(dataMov, 'Data de aquisição')

    const tx = db.transaction(() => {
      const result = db
        .query(
          `INSERT INTO equipamentos (
            tombamento, nome, descricao, categoria_id, setor_id, complemento_local,
            marca, modelo, numero_serie, status, data_aquisicao, valor_aquisicao_centavos,
            fornecedor, nota_fiscal, garantia_ate, observacoes,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
        )
        .run(
          input.tombamento.trim(),
          input.nome.trim(),
          nullIfEmpty(input.descricao),
          input.categoriaId,
          input.setorId,
          nullIfEmpty(input.complementoLocal),
          nullIfEmpty(input.marca),
          nullIfEmpty(input.modelo),
          nullIfEmpty(input.numeroSerie),
          input.status,
          nullIfEmpty(input.dataAquisicao),
          input.valorAquisicaoCentavos ?? null,
          nullIfEmpty(input.fornecedor),
          nullIfEmpty(input.notaFiscal),
          nullIfEmpty(input.garantiaAte),
          nullIfEmpty(input.observacoes),
        )

      const id = Number(result.lastInsertRowid)
      db.query(
        `INSERT INTO movimentacoes (
          equipamento_id, setor_origem_id, setor_destino_id,
          complemento_origem, complemento_destino, motivo, data_movimentacao, created_at
        ) VALUES (?, NULL, ?, NULL, ?, 'Cadastro inicial', ?, datetime('now','localtime'))`,
      ).run(id, input.setorId, nullIfEmpty(input.complementoLocal), dataMov)
      return id
    })

    const id = tx()
    return getEquipamento(id)
  })
}

export function updateEquipamento(
  id: number,
  input: UpdateEquipamentoInput,
): EquipamentoDetalhe {
  return wrapDb(() => {
    const db = getDb()
    const atual = getEquipamento(id)
    if (atual.temManutencaoAberta) {
      // status is not editable here anyway
    }
    assertCategoriaAtiva(input.categoriaId)
    if (input.dataAquisicao) assertNotFuture(input.dataAquisicao, 'Data de aquisição')

    db.query(
      `UPDATE equipamentos SET
        tombamento = ?, nome = ?, descricao = ?, categoria_id = ?,
        marca = ?, modelo = ?, numero_serie = ?,
        data_aquisicao = ?, valor_aquisicao_centavos = ?,
        fornecedor = ?, nota_fiscal = ?, garantia_ate = ?, observacoes = ?,
        updated_at = datetime('now','localtime')
       WHERE id = ?`,
    ).run(
      input.tombamento.trim(),
      input.nome.trim(),
      nullIfEmpty(input.descricao),
      input.categoriaId,
      nullIfEmpty(input.marca),
      nullIfEmpty(input.modelo),
      nullIfEmpty(input.numeroSerie),
      nullIfEmpty(input.dataAquisicao),
      input.valorAquisicaoCentavos ?? null,
      nullIfEmpty(input.fornecedor),
      nullIfEmpty(input.notaFiscal),
      nullIfEmpty(input.garantiaAte),
      nullIfEmpty(input.observacoes),
      id,
    )
    return getEquipamento(id)
  })
}

export function transferirEquipamento(
  id: number,
  input: TransferirInput,
): EquipamentoDetalhe {
  return wrapDb(() => {
    const db = getDb()
    const atual = getEquipamento(id)
    if (atual.status === 'baixado') {
      throw new AppError('Equipamento baixado não pode ser transferido.')
    }
    assertSetorAtivo(input.setorDestinoId)
    assertNotFuture(input.dataMovimentacao, 'Data da movimentação')

    const complementoDestino = nullIfEmpty(input.complementoDestino)
    const mesmoSetor = atual.setorId === input.setorDestinoId
    const mesmoComplemento =
      (atual.complementoLocal ?? null) === (complementoDestino ?? null)
    if (mesmoSetor && mesmoComplemento) {
      throw new AppError('Setor e localização de destino são iguais aos atuais.')
    }
    if (atual.dataAquisicao && isBefore(input.dataMovimentacao, atual.dataAquisicao)) {
      throw new AppError('Data da movimentação não pode ser anterior à aquisição.')
    }

    const tx = db.transaction(() => {
      db.query(
        `INSERT INTO movimentacoes (
          equipamento_id, setor_origem_id, setor_destino_id,
          complemento_origem, complemento_destino, motivo, data_movimentacao, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))`,
      ).run(
        id,
        atual.setorId,
        input.setorDestinoId,
        atual.complementoLocal,
        complementoDestino,
        input.motivo.trim(),
        input.dataMovimentacao,
      )
      db.query(
        `UPDATE equipamentos
         SET setor_id = ?, complemento_local = ?, updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(input.setorDestinoId, complementoDestino, id)
    })
    tx()
    return getEquipamento(id)
  })
}

export function baixarEquipamento(id: number, input: BaixarInput): EquipamentoDetalhe {
  return wrapDb(() => {
    const db = getDb()
    const atual = getEquipamento(id)
    if (atual.status === 'baixado') {
      throw new AppError('Equipamento já está baixado.')
    }
    if (atual.temManutencaoAberta) {
      throw new AppError(
        'Conclua ou cancele a manutenção aberta antes de baixar o equipamento.',
      )
    }
    assertNotFuture(input.dataBaixa, 'Data da baixa')

    db.query(
      `UPDATE equipamentos
       SET status = 'baixado', motivo_baixa = ?, data_baixa = ?,
           updated_at = datetime('now','localtime')
       WHERE id = ?`,
    ).run(input.motivoBaixa.trim(), input.dataBaixa, id)
    return getEquipamento(id)
  })
}

export function reativarEquipamento(id: number): EquipamentoDetalhe {
  return wrapDb(() => {
    const db = getDb()
    const atual = getEquipamento(id)
    if (atual.status !== 'baixado') {
      throw new AppError('Somente equipamentos baixados podem ser reativados.')
    }
    db.query(
      `UPDATE equipamentos
       SET status = 'em_estoque', motivo_baixa = NULL, data_baixa = NULL,
           updated_at = datetime('now','localtime')
       WHERE id = ?`,
    ).run(id)
    return getEquipamento(id)
  })
}

export function deleteEquipamento(id: number, tombamentoConfirmacao: string) {
  return wrapDb(() => {
    const db = getDb()
    const atual = getEquipamento(id)
    if (atual.tombamento.toLowerCase() !== tombamentoConfirmacao.trim().toLowerCase()) {
      throw new AppError('Tombamento de confirmação não confere.')
    }
    db.query('DELETE FROM equipamentos WHERE id = ?').run(id)
  })
}
