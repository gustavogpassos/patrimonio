import { describe, expect, test } from 'bun:test'
import { garantiaInfo, manutencaoRegularInfo } from './dates'

describe('garantiaInfo', () => {
  test('sem garantia', () => {
    expect(garantiaInfo(null, '2026-11-19').kind).toBe('none')
  })

  test('vencida', () => {
    const info = garantiaInfo('2026-11-01', '2026-11-19')
    expect(info.kind).toBe('expired')
  })

  test('vence em 30', () => {
    const info = garantiaInfo('2026-12-01', '2026-11-19')
    expect(info.kind).toBe('soon')
    if (info.kind === 'soon') expect(info.label).toContain('Vence em')
  })

  test('ok', () => {
    const info = garantiaInfo('2027-11-19', '2026-11-19')
    expect(info.kind).toBe('ok')
  })
})

describe('manutencaoRegularInfo', () => {
  test('sem frequência não avisa', () => {
    expect(
      manutencaoRegularInfo({
        intervaloDias: null,
        cadastradoEm: '2026-01-01 10:00:00',
        ultimaConclusao: null,
        today: '2026-06-01',
      }).kind,
    ).toBe('none')
  })

  test('baixado não avisa', () => {
    expect(
      manutencaoRegularInfo({
        intervaloDias: 30,
        cadastradoEm: '2026-01-01',
        ultimaConclusao: null,
        today: '2026-06-01',
        baixado: true,
      }).kind,
    ).toBe('none')
  })

  test('a contagem começa no cadastro e vence no dia', () => {
    const info = manutencaoRegularInfo({
      intervaloDias: 30,
      cadastradoEm: '2026-01-01 15:30:00',
      ultimaConclusao: null,
      today: '2026-01-31',
    })
    expect(info).toMatchObject({
      kind: 'due',
      vencimento: '2026-01-31',
      label: 'Manutenção hoje',
    })
  })

  test('antes do prazo está em dia', () => {
    const info = manutencaoRegularInfo({
      intervaloDias: 30,
      cadastradoEm: '2026-01-01',
      ultimaConclusao: null,
      today: '2026-01-30',
    })
    expect(info.kind).toBe('ok')
    if (info.kind === 'ok') expect(info.vencimento).toBe('2026-01-31')
  })

  test('depois do prazo avisa o atraso', () => {
    const info = manutencaoRegularInfo({
      intervaloDias: 30,
      cadastradoEm: '2026-01-01',
      ultimaConclusao: null,
      today: '2026-02-02',
    })
    expect(info).toMatchObject({ kind: 'due', label: 'Atrasada há 2 dias' })
  })

  test('manutenção concluída reinicia a contagem', () => {
    const info = manutencaoRegularInfo({
      intervaloDias: 30,
      cadastradoEm: '2026-01-01',
      ultimaConclusao: '2026-02-01',
      today: '2026-02-10',
    })
    expect(info.kind).toBe('ok')
    if (info.kind === 'ok') expect(info.vencimento).toBe('2026-03-03')
  })
})
