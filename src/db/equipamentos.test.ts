import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { listCategorias } from './categorias'
import {
  createEquipamento,
  getEquipamento,
  nextTombamento,
  transferirEquipamento,
} from './equipamentos'
import { AppError } from './errors'
import {
  abrirManutencao,
  cancelarManutencao,
  concluirManutencao,
} from './manutencoes'
import { deleteSetor, saveSetor } from './setores'
import { closeDb, useTestDatabase } from './sqlite'

const dir = join(process.cwd(), 'data', 'test-tmp')

function setup() {
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `t-${Date.now()}-${Math.random()}.db`)
  useTestDatabase(path)
  const cat = listCategorias(true)[0]!
  const setorA = saveSetor({ nome: 'TI', descricao: null, ativo: true })
  const setorB = saveSetor({ nome: 'Financeiro', descricao: null, ativo: true })
  return { cat, setorA, setorB }
}

afterEach(() => {
  closeDb()
})

describe('equipamentos regras', () => {
  test('próximo tombamento', () => {
    const { cat, setorA } = setup()
    expect(nextTombamento()).toBe('PAT-000001')
    createEquipamento({
      tombamento: 'PAT-000001',
      nome: 'PC 1',
      descricao: null,
      categoriaId: cat.id,
      setorId: setorA.id,
      complementoLocal: null,
      status: 'em_estoque',
      marca: null,
      modelo: null,
      numeroSerie: null,
      dataAquisicao: null,
      valorAquisicaoCentavos: null,
      fornecedor: null,
      notaFiscal: null,
      garantiaAte: null,
      observacoes: null,
    })
    expect(nextTombamento()).toBe('PAT-000002')
  })

  test('tombamento duplicado', () => {
    const { cat, setorA } = setup()
    const base = {
      tombamento: 'PAT-000001',
      nome: 'PC 1',
      descricao: null as string | null,
      categoriaId: cat.id,
      setorId: setorA.id,
      complementoLocal: null as string | null,
      status: 'em_estoque' as const,
      marca: null as string | null,
      modelo: null as string | null,
      numeroSerie: null as string | null,
      dataAquisicao: null as string | null,
      valorAquisicaoCentavos: null as number | null,
      fornecedor: null as string | null,
      notaFiscal: null as string | null,
      garantiaAte: null as string | null,
      observacoes: null as string | null,
    }
    createEquipamento(base)
    expect(() => createEquipamento({ ...base, nome: 'PC 2' })).toThrow(
      'Já existe um equipamento com este tombamento.',
    )
  })

  test('série duplicada', () => {
    const { cat, setorA } = setup()
    const base = {
      tombamento: 'PAT-000001',
      nome: 'PC 1',
      descricao: null as string | null,
      categoriaId: cat.id,
      setorId: setorA.id,
      complementoLocal: null as string | null,
      status: 'em_estoque' as const,
      marca: null as string | null,
      modelo: null as string | null,
      numeroSerie: 'SN-1',
      dataAquisicao: null as string | null,
      valorAquisicaoCentavos: null as number | null,
      fornecedor: null as string | null,
      notaFiscal: null as string | null,
      garantiaAte: null as string | null,
      observacoes: null as string | null,
    }
    createEquipamento(base)
    expect(() =>
      createEquipamento({ ...base, tombamento: 'PAT-000002', nome: 'PC 2' }),
    ).toThrow('Já existe um equipamento com este número de série.')
  })

  test('exclusão de setor ocupado', () => {
    const { cat, setorA } = setup()
    createEquipamento({
      tombamento: 'PAT-000001',
      nome: 'PC 1',
      descricao: null,
      categoriaId: cat.id,
      setorId: setorA.id,
      complementoLocal: null,
      status: 'em_estoque',
      marca: null,
      modelo: null,
      numeroSerie: null,
      dataAquisicao: null,
      valorAquisicaoCentavos: null,
      fornecedor: null,
      notaFiscal: null,
      garantiaAte: null,
      observacoes: null,
    })
    expect(() => deleteSetor(setorA.id)).toThrow(/Inative o setor/)
  })

  test('transferência e destino igual', () => {
    const { cat, setorA, setorB } = setup()
    const e = createEquipamento({
      tombamento: 'PAT-000001',
      nome: 'PC 1',
      descricao: null,
      categoriaId: cat.id,
      setorId: setorA.id,
      complementoLocal: 'Sala 1',
      status: 'em_uso',
      marca: null,
      modelo: null,
      numeroSerie: null,
      dataAquisicao: '2024-01-01',
      valorAquisicaoCentavos: null,
      fornecedor: null,
      notaFiscal: null,
      garantiaAte: null,
      observacoes: null,
    })
    expect(() =>
      transferirEquipamento(e.id, {
        setorDestinoId: setorA.id,
        complementoDestino: 'Sala 1',
        dataMovimentacao: '2024-02-01',
        motivo: 'Mesmo lugar',
      }),
    ).toThrow(/iguais aos atuais/)

    const moved = transferirEquipamento(e.id, {
      setorDestinoId: setorB.id,
      complementoDestino: 'Sala 2',
      dataMovimentacao: '2024-02-01',
      motivo: 'Mudança de setor',
    })
    expect(moved.setorId).toBe(setorB.id)
    expect(moved.movimentacoes.length).toBe(2)
  })

  test('uma única manutenção aberta e cancelamento', () => {
    const { cat, setorA } = setup()
    const e = createEquipamento({
      tombamento: 'PAT-000001',
      nome: 'PC 1',
      descricao: null,
      categoriaId: cat.id,
      setorId: setorA.id,
      complementoLocal: null,
      status: 'em_uso',
      marca: null,
      modelo: null,
      numeroSerie: null,
      dataAquisicao: null,
      valorAquisicaoCentavos: null,
      fornecedor: null,
      notaFiscal: null,
      garantiaAte: null,
      observacoes: null,
    })
    const m = abrirManutencao({
      equipamentoId: e.id,
      tipo: 'corretiva',
      dataAbertura: '2026-11-01',
      descricaoProblema: 'Não liga',
      custoCentavos: null,
      fornecedorAssistencia: null,
    })
    expect(getEquipamento(e.id).status).toBe('em_manutencao')
    expect(() =>
      abrirManutencao({
        equipamentoId: e.id,
        tipo: 'preventiva',
        dataAbertura: '2026-11-02',
        descricaoProblema: 'Outra',
        custoCentavos: null,
        fornecedorAssistencia: null,
      }),
    ).toThrow()

    cancelarManutencao(m.id, { motivoCancelamento: 'Falso alarme' })
    expect(getEquipamento(e.id).status).toBe('em_uso')
  })

  test('conclusão com baixa', () => {
    const { cat, setorA } = setup()
    const e = createEquipamento({
      tombamento: 'PAT-000001',
      nome: 'PC 1',
      descricao: null,
      categoriaId: cat.id,
      setorId: setorA.id,
      complementoLocal: null,
      status: 'em_estoque',
      marca: null,
      modelo: null,
      numeroSerie: null,
      dataAquisicao: null,
      valorAquisicaoCentavos: null,
      fornecedor: null,
      notaFiscal: null,
      garantiaAte: null,
      observacoes: null,
    })
    const m = abrirManutencao({
      equipamentoId: e.id,
      tipo: 'corretiva',
      dataAbertura: '2026-11-01',
      descricaoProblema: 'Queimou',
      custoCentavos: null,
      fornecedorAssistencia: null,
    })
    concluirManutencao(m.id, {
      dataConclusao: '2026-11-02',
      solucao: 'Irrecuperável',
      custoCentavos: null,
      fornecedorAssistencia: null,
      statusEquipamentoApos: 'baixado',
      motivoBaixa: 'Sucata',
    })
    const after = getEquipamento(e.id)
    expect(after.status).toBe('baixado')
    expect(after.motivoBaixa).toBe('Sucata')
  })

  test('cadastro recusa status baixado via schema path', () => {
    const { cat, setorA } = setup()
    expect(() =>
      createEquipamento({
        tombamento: 'PAT-000001',
        nome: 'PC 1',
        descricao: null,
        categoriaId: cat.id,
        setorId: setorA.id,
        complementoLocal: null,
        // @ts-expect-error status inválido no cadastro
        status: 'baixado',
        marca: null,
        modelo: null,
        numeroSerie: null,
        dataAquisicao: null,
        valorAquisicaoCentavos: null,
        fornecedor: null,
        notaFiscal: null,
        garantiaAte: null,
        observacoes: null,
      }),
    ).toThrow(AppError)
  })
})

afterEach(() => {
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
})
