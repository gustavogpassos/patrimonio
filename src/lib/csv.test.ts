import { describe, expect, test } from 'bun:test'
import { buildEquipamentosCsv } from './csv'
import type { EquipamentoListItem } from './types'

const sample: EquipamentoListItem = {
  id: 1,
  tombamento: 'PAT-000001',
  nome: 'PC; Lab',
  descricao: 'linha\nquebrada',
  categoriaId: 1,
  categoriaNome: 'Computador',
  categoriaAtivo: true,
  setorId: 1,
  setorNome: 'TI',
  setorAtivo: true,
  complementoLocal: null,
  marca: 'Dell',
  modelo: 'OptiPlex',
  numeroSerie: 'ABC',
  status: 'em_uso',
  dataAquisicao: '2024-01-10',
  valorAquisicaoCentavos: 150050,
  fornecedor: null,
  notaFiscal: null,
  garantiaAte: null,
  observacoes: null,
  motivoBaixa: null,
  dataBaixa: null,
  createdAt: '',
  updatedAt: '',
}

describe('csv', () => {
  test('BOM e separador', () => {
    const csv = buildEquipamentosCsv([sample])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain(';')
    expect(csv).toContain('localização')
    expect(csv).not.toContain('complemento')
    expect(csv).toContain('Em uso')
    expect(csv).toContain('1500,50')
    expect(csv).toContain('"PC; Lab"')
  })
})
