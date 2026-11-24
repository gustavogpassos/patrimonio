import { addDays, todayLocal } from '@/lib/dates'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { saveCategoria } from './categorias'
import { dashboard } from './dashboard'
import { baixarEquipamento, createEquipamento } from './equipamentos'
import { abrirManutencao, concluirManutencao } from './manutencoes'
import { saveSetor } from './setores'
import { closeDb, getDb, useTestDatabase } from './sqlite'

const dir = join(process.cwd(), 'data', 'test-tmp')

function setup() {
  mkdirSync(dir, { recursive: true })
  useTestDatabase(join(dir, `mr-${Date.now()}-${Math.random()}.db`))
  const setor = saveSetor({ nome: 'TI', descricao: null, ativo: true })
  return { setor }
}

function equipamento(categoriaId: number, setorId: number, tombamento: string) {
  return createEquipamento({
    tombamento,
    nome: tombamento,
    descricao: null,
    categoriaId,
    setorId,
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
}

function backdate(id: number, isoDate: string) {
  getDb()
    .query('UPDATE equipamentos SET created_at = ? WHERE id = ?')
    .run(`${isoDate} 08:00:00`, id)
}

afterEach(() => {
  closeDb()
})

describe('manutenção regular', () => {
  test('categoria guarda a frequência e exige os dias quando o check está marcado', () => {
    const { setor } = setup()
    expect(setor.id).toBeGreaterThan(0)
    const cat = saveCategoria({
      nome: 'Nobreak teste',
      descricao: null,
      ativo: true,
      manutencaoRegular: true,
      intervaloManutencaoDias: 30,
    })
    expect(cat.manutencaoRegular).toBe(true)
    expect(cat.intervaloManutencaoDias).toBe(30)

    const off = saveCategoria({
      id: cat.id,
      nome: cat.nome,
      descricao: null,
      ativo: true,
      manutencaoRegular: false,
      intervaloManutencaoDias: 30,
    })
    expect(off.manutencaoRegular).toBe(false)
    expect(off.intervaloManutencaoDias).toBeNull()

    expect(() =>
      saveCategoria({
        nome: 'Sem dias',
        descricao: null,
        ativo: true,
        manutencaoRegular: true,
        intervaloManutencaoDias: null,
      }),
    ).toThrow(/frequência/)
  })

  test('aviso conta do cadastro e a conclusão reinicia o prazo', () => {
    const { setor } = setup()
    const today = todayLocal()
    const cat = saveCategoria({
      nome: 'Nobreak teste',
      descricao: null,
      ativo: true,
      manutencaoRegular: true,
      intervaloManutencaoDias: 30,
    })

    const vencido = equipamento(cat.id, setor.id, 'PAT-000001')
    backdate(vencido.id, addDays(today, -30))

    const emDia = equipamento(cat.id, setor.id, 'PAT-000002')
    backdate(emDia.id, addDays(today, -10))

    const reiniciado = equipamento(cat.id, setor.id, 'PAT-000003')
    backdate(reiniciado.id, addDays(today, -90))
    const feita = abrirManutencao({
      equipamentoId: reiniciado.id,
      tipo: 'preventiva',
      dataAbertura: addDays(today, -5),
      descricaoProblema: 'Revisão periódica',
      custoCentavos: null,
      fornecedorAssistencia: null,
    })
    concluirManutencao(feita.id, {
      dataConclusao: addDays(today, -5),
      solucao: 'Revisão feita',
      custoCentavos: null,
      fornecedorAssistencia: null,
      statusEquipamentoApos: 'em_uso',
      motivoBaixa: null,
    })

    const aberta = equipamento(cat.id, setor.id, 'PAT-000004')
    backdate(aberta.id, addDays(today, -40))
    abrirManutencao({
      equipamentoId: aberta.id,
      tipo: 'corretiva',
      dataAbertura: addDays(today, -1),
      descricaoProblema: 'Não liga',
      custoCentavos: null,
      fornecedorAssistencia: null,
    })

    const semRotina = saveCategoria({
      nome: 'Monitor teste',
      descricao: null,
      ativo: true,
      manutencaoRegular: false,
      intervaloManutencaoDias: null,
    })
    backdate(equipamento(semRotina.id, setor.id, 'PAT-000005').id, addDays(today, -400))

    const baixado = equipamento(cat.id, setor.id, 'PAT-000006')
    backdate(baixado.id, addDays(today, -400))
    baixarEquipamento(baixado.id, { dataBaixa: today, motivoBaixa: 'Quebrou de vez' })

    expect(dashboard().manutencoesRegularesVencidas.map((e) => e.tombamento)).toEqual([
      'PAT-000004',
      'PAT-000001',
    ])
  })
})
