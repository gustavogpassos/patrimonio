import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listCategorias } from './categorias'
import { migrate } from './migrate'
import { listSetores, saveSetor } from './setores'
import { closeDb, getDb, useTestDatabase } from './sqlite'

afterEach(() => {
  closeDb()
})

describe('migrações', () => {
  test('rodar de novo preserva os dados e não repete a semente', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pat-mig-'))
    const path = join(dir, 'patrimonio.db')
    try {
      useTestDatabase(path)
      const categorias = listCategorias(true).length
      expect(categorias).toBeGreaterThan(0)
      saveSetor({ nome: 'Almoxarifado', descricao: null, ativo: true })

      migrate(getDb())

      expect(listCategorias(true)).toHaveLength(categorias)
      expect(listSetores(true).some((setor) => setor.nome === 'Almoxarifado')).toBe(true)
      const versions = getDb().query<{ version: number }, []>('SELECT version FROM schema_migrations').all()
      expect(versions.map((row) => row.version)).toEqual([1])
    } finally {
      closeDb()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
