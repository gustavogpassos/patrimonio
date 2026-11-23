import { formatBRLPlain } from './money'
import { STATUS_LABELS, type EquipamentoListItem } from './types'

function escapeCsv(value: string | null | undefined): string {
  const v = value ?? ''
  if (/[;"\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export function buildEquipamentosCsv(items: EquipamentoListItem[]): string {
  const header = [
    'tombamento',
    'nome',
    'descrição',
    'categoria',
    'setor',
    'complemento',
    'marca',
    'modelo',
    'número de série',
    'status',
    'data de aquisição',
    'valor',
    'fornecedor',
    'nota fiscal',
    'garantia até',
    'observações',
  ].join(';')

  const rows = items.map((e) =>
    [
      escapeCsv(e.tombamento),
      escapeCsv(e.nome),
      escapeCsv(e.descricao),
      escapeCsv(e.categoriaNome),
      escapeCsv(e.setorNome),
      escapeCsv(e.complementoLocal),
      escapeCsv(e.marca),
      escapeCsv(e.modelo),
      escapeCsv(e.numeroSerie),
      escapeCsv(STATUS_LABELS[e.status]),
      escapeCsv(e.dataAquisicao),
      escapeCsv(formatBRLPlain(e.valorAquisicaoCentavos)),
      escapeCsv(e.fornecedor),
      escapeCsv(e.notaFiscal),
      escapeCsv(e.garantiaAte),
      escapeCsv(e.observacoes),
    ].join(';'),
  )

  return `\uFEFF${[header, ...rows].join('\n')}`
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
