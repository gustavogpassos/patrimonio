export type EquipmentStatus = 'in_use' | 'in_stock' | 'in_maintenance' | 'written_off'
export type MaintenanceType = 'preventive' | 'corrective'
export type MaintenanceState = 'open' | 'completed' | 'cancelled'

export type Category = {
  id: number
  name: string
  description: string | null
  active: boolean
  regularMaintenance: boolean
  maintenanceIntervalDays: number | null
  equipmentCount: number
  createdAt: string
  updatedAt: string
}

export type Sector = {
  id: number
  name: string
  description: string | null
  active: boolean
  equipmentCount: number
  createdAt: string
  updatedAt: string
}

export type EquipmentListItem = {
  id: number
  assetTag: string
  name: string
  description: string | null
  categoryId: number
  categoryName: string
  categoryActive: boolean
  categoryRegularMaintenance: boolean
  categoryMaintenanceIntervalDays: number | null
  lastMaintenanceCompletedAt: string | null
  sectorId: number
  sectorName: string
  sectorActive: boolean
  location: string | null
  brand: string | null
  model: string | null
  serialNumber: string | null
  status: EquipmentStatus
  acquiredOn: string | null
  acquisitionValueCents: number | null
  supplier: string | null
  invoice: string | null
  warrantyUntil: string | null
  notes: string | null
  writeOffReason: string | null
  writtenOffOn: string | null
  createdAt: string
  updatedAt: string
}

export type Transfer = {
  id: number
  equipmentId: number
  fromSectorId: number | null
  fromSectorName: string | null
  toSectorId: number
  toSectorName: string
  fromLocation: string | null
  toLocation: string | null
  reason: string
  transferredOn: string
  createdAt: string
}

export type Maintenance = {
  id: number
  equipmentId: number
  equipmentName?: string
  equipmentAssetTag?: string
  type: MaintenanceType
  state: MaintenanceState
  openedOn: string
  completedOn: string | null
  problem: string
  solution: string | null
  costCents: number | null
  serviceProvider: string | null
  cancellationReason: string | null
  previousStatus: EquipmentStatus
  equipmentStatusAfter: 'in_use' | 'in_stock' | 'written_off' | null
  createdAt: string
  updatedAt: string
}

export type EquipmentDetail = EquipmentListItem & {
  transfers: Transfer[]
  maintenance: Maintenance[]
  hasOpenMaintenance: boolean
}

export type Paginated<T> = {
  items: T[]
  total: number
}

export type DashboardData = {
  activeCount: number
  inUse: number
  inStock: number
  inMaintenance: number
  writtenOff: number
  totalValueCents: number
  expiredWarranties: EquipmentListItem[]
  warrantiesDueSoon: EquipmentListItem[]
  overdueRegularMaintenance: EquipmentListItem[]
  openMaintenance: Maintenance[]
  recentTransfers: Array<Transfer & {
    equipmentName: string
    equipmentAssetTag: string
  }>
}

export const STATUS_LABELS: Record<EquipmentStatus, string> = {
  in_use: 'Em uso',
  in_stock: 'Em estoque',
  in_maintenance: 'Em manutenção',
  written_off: 'Baixado',
}

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  preventive: 'Preventiva',
  corrective: 'Corretiva',
}

export const MAINTENANCE_STATE_LABELS: Record<MaintenanceState, string> = {
  open: 'Aberta',
  completed: 'Concluída',
  cancelled: 'Cancelada',
}
