import type { CategoriaInput } from '@/lib/schemas'
import type { Categoria } from '@/lib/types'
import { AppError, wrapDb } from './errors'
import { getDb, nullIfEmpty } from './sqlite'

type Row = {
  id: number
  nome: string
  descricao: string | null
  ativo: number
  manutencao_regular: number
  intervalo_manutencao_dias: number | null
  equipamentos_count: number
  created_at: string
  updated_at: string
}

function mapRow(r: Row): Categoria {
  return {
    id: r.id,
    nome: r.nome,
    descricao: r.descricao,
    ativo: r.ativo === 1,
    manutencaoRegular: r.manutencao_regular === 1,
    intervaloManutencaoDias: r.intervalo_manutencao_dias,
    equipamentosCount: r.equipamentos_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function listCategorias(incluirInativos = false): Categoria[] {
  return wrapDb(() => {
    const db = getDb()
    const rows = db
      .query<Row, [number]>(
        `SELECT c.*,
          (SELECT COUNT(*) FROM equipamentos e WHERE e.categoria_id = c.id) AS equipamentos_count
         FROM categorias c
         WHERE (? = 1 OR c.ativo = 1)
         ORDER BY c.nome COLLATE NOCASE`,
      )
      .all(incluirInativos ? 1 : 0)
    return rows.map(mapRow)
  })
}

export function saveCategoria(input: CategoriaInput & { id?: number }): Categoria {
  return wrapDb(() => {
    const db = getDb()
    const nome = input.nome.trim()
    const descricao = nullIfEmpty(input.descricao)
    const ativo = input.ativo ? 1 : 0
    const manutencaoRegular = input.manutencaoRegular ? 1 : 0
    const intervalo = intervaloDaCategoria(input)

    if (input.id) {
      db.query(
        `UPDATE categorias
         SET nome = ?, descricao = ?, ativo = ?,
             manutencao_regular = ?, intervalo_manutencao_dias = ?,
             updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(nome, descricao, ativo, manutencaoRegular, intervalo, input.id)
      return getCategoria(input.id)
    }

    const result = db
      .query(
        `INSERT INTO categorias (
           nome, descricao, ativo, manutencao_regular, intervalo_manutencao_dias,
           created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
      )
      .run(nome, descricao, ativo, manutencaoRegular, intervalo)
    return getCategoria(Number(result.lastInsertRowid))
  })
}

function intervaloDaCategoria(input: CategoriaInput): number | null {
  if (!input.manutencaoRegular) return null
  const dias = input.intervaloManutencaoDias
  if (dias == null || !Number.isInteger(dias) || dias < 1 || dias > 3650) {
    throw new AppError('Informe a frequência da manutenção regular, em dias.')
  }
  return dias
}

export function getCategoria(id: number): Categoria {
  return wrapDb(() => {
    const db = getDb()
    const row = db
      .query<Row, [number]>(
        `SELECT c.*,
          (SELECT COUNT(*) FROM equipamentos e WHERE e.categoria_id = c.id) AS equipamentos_count
         FROM categorias c WHERE c.id = ?`,
      )
      .get(id)
    if (!row) throw new AppError('Categoria não encontrada.')
    return mapRow(row)
  })
}

export function deleteCategoria(id: number) {
  return wrapDb(() => {
    const db = getDb()
    const count = db
      .query<{ c: number }, [number]>(
        'SELECT COUNT(*) AS c FROM equipamentos WHERE categoria_id = ?',
      )
      .get(id)?.c ?? 0
    if (count > 0) {
      throw new AppError(
        'Não é possível excluir: há equipamentos nesta categoria. Inative a categoria.',
      )
    }
    const result = db.query('DELETE FROM categorias WHERE id = ?').run(id)
    if (result.changes === 0) throw new AppError('Categoria não encontrada.')
  })
}
