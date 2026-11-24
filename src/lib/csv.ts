import { formatBRLPlain } from './money'
import { STATUS_LABELS, type EquipmentListItem } from './types'

function escapeCsv(value: string | null | undefined): string {
  const v = value ?? ''
  if (/[;"\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export function buildEquipmentCsv(items: EquipmentListItem[]): string {
  const header = [
    'tombamento',
    'nome',
    'descrição',
    'categoria',
    'setor',
    'localização',
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

  const rows = items.map((item) =>
    [
      escapeCsv(item.assetTag),
      escapeCsv(item.name),
      escapeCsv(item.description),
      escapeCsv(item.categoryName),
      escapeCsv(item.sectorName),
      escapeCsv(item.location),
      escapeCsv(item.brand),
      escapeCsv(item.model),
      escapeCsv(item.serialNumber),
      escapeCsv(STATUS_LABELS[item.status]),
      escapeCsv(item.acquiredOn),
      escapeCsv(formatBRLPlain(item.acquisitionValueCents)),
      escapeCsv(item.supplier),
      escapeCsv(item.invoice),
      escapeCsv(item.warrantyUntil),
      escapeCsv(item.notes),
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
