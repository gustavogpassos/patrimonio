import type { SetorInput } from '@/lib/schemas'
import type { Setor } from '@/lib/types'
import { AppError, wrapDb } from './errors'
import { getDb, nullIfEmpty } from './sqlite'

type Row = {
  id: number
  nome: string
  descricao: string | null
  ativo: number
  equipamentos_count: number
  created_at: string
  updated_at: string
}

function mapRow(r: Row): Setor {
  return {
    id: r.id,
    nome: r.nome,
    descricao: r.descricao,
    ativo: r.ativo === 1,
    equipamentosCount: r.equipamentos_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export function listSetores(incluirInativos = false): Setor[] {
  return wrapDb(() => {
    const db = getDb()
    const rows = db
      .query<Row, [number]>(
        `SELECT s.*,
          (SELECT COUNT(*) FROM equipamentos e WHERE e.setor_id = s.id) AS equipamentos_count
         FROM setores s
         WHERE (? = 1 OR s.ativo = 1)
         ORDER BY s.nome COLLATE NOCASE`,
      )
      .all(incluirInativos ? 1 : 0)
    return rows.map(mapRow)
  })
}

export function saveSetor(input: SetorInput & { id?: number }): Setor {
  return wrapDb(() => {
    const db = getDb()
    const nome = input.nome.trim()
    const descricao = nullIfEmpty(input.descricao)
    const ativo = input.ativo ? 1 : 0

    if (input.id) {
      db.query(
        `UPDATE setores
         SET nome = ?, descricao = ?, ativo = ?, updated_at = datetime('now','localtime')
         WHERE id = ?`,
      ).run(nome, descricao, ativo, input.id)
      return getSetor(input.id)
    }

    const result = db
      .query(
        `INSERT INTO setores (nome, descricao, ativo, created_at, updated_at)
         VALUES (?, ?, ?, datetime('now','localtime'), datetime('now','localtime'))`,
      )
      .run(nome, descricao, ativo)
    return getSetor(Number(result.lastInsertRowid))
  })
}

export function getSetor(id: number): Setor {
  return wrapDb(() => {
    const db = getDb()
    const row = db
      .query<Row, [number]>(
        `SELECT s.*,
          (SELECT COUNT(*) FROM equipamentos e WHERE e.setor_id = s.id) AS equipamentos_count
         FROM setores s WHERE s.id = ?`,
      )
      .get(id)
    if (!row) throw new AppError('Setor não encontrado.')
    return mapRow(row)
  })
}

export function deleteSetor(id: number) {
  return wrapDb(() => {
    const db = getDb()
    const count = db
      .query<{ c: number }, [number]>(
        'SELECT COUNT(*) AS c FROM equipamentos WHERE setor_id = ?',
      )
      .get(id)?.c ?? 0
    if (count > 0) {
      throw new AppError(
        'Não é possível excluir: há equipamentos neste setor. Inative o setor.',
      )
    }
    const result = db.query('DELETE FROM setores WHERE id = ?').run(id)
    if (result.changes === 0) throw new AppError('Setor não encontrado.')
  })
}
