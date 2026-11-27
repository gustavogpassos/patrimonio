import { BASE_PATH } from '@/base-path'
import type {
  Category,
  DashboardData,
  EquipmentDetail,
  EquipmentListItem,
  EquipmentStatus,
  Maintenance,
  MaintenanceState,
  MaintenanceType,
  Paginated,
  Sector,
} from './types'
import type {
  CancelMaintenanceInput,
  CategoryInput,
  CompleteMaintenanceInput,
  CreateEquipmentInput,
  OpenMaintenanceInput,
  SectorInput,
  TransferInput,
  UpdateEquipmentInput,
  WriteOffInput,
} from './schemas'

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('/api/') ? `${BASE_PATH}${path}` : path
  const res = await fetch(url, init)
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      let next = '/'
      const { pathname, search } = window.location
      if (pathname.startsWith(BASE_PATH)) {
        const rest = pathname.slice(BASE_PATH.length)
        next = (rest.length === 0 ? '/' : rest) + search
      }
      window.location.assign(
        `${BASE_PATH}/api/auth/login?next=${encodeURIComponent(next)}`,
      )
    }
    let message = 'Não foi possível concluir a operação.'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore
    }
    throw new ApiError(message)
  }
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    return (await res.json()) as T
  }
  return undefined as T
}

function jsonBody(data: unknown): RequestInit {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
}

export const api = {
  dashboard: () => request<DashboardData>('/api/dashboard'),

  listSectors: (includeInactive = false) =>
    request<Sector[]>(`/api/sectors?includeInactive=${includeInactive}`),
  saveSector: (data: SectorInput & { id?: number }) =>
    data.id
      ? request<Sector>(`/api/sectors/${data.id}`, { method: 'PATCH', ...jsonBody(data) })
      : request<Sector>('/api/sectors', { method: 'POST', ...jsonBody(data) }),
  deleteSector: (id: number) =>
    request<{ ok: boolean }>(`/api/sectors/${id}`, { method: 'DELETE' }),

  listCategories: (includeInactive = false) =>
    request<Category[]>(`/api/categories?includeInactive=${includeInactive}`),
  saveCategory: (data: CategoryInput & { id?: number }) =>
    data.id
      ? request<Category>(`/api/categories/${data.id}`, {
          method: 'PATCH',
          ...jsonBody(data),
        })
      : request<Category>('/api/categories', { method: 'POST', ...jsonBody(data) }),
  deleteCategory: (id: number) =>
    request<{ ok: boolean }>(`/api/categories/${id}`, { method: 'DELETE' }),

  nextAssetTag: () =>
    request<{ assetTag: string }>('/api/equipment/next-asset-tag'),

  listEquipment: (params: {
    q?: string
    categoryId?: number
    sectorId?: number
    status?: EquipmentStatus
    sort?: string
    order?: string
    page?: number
    pageSize?: number
  } = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.categoryId) qs.set('categoryId', String(params.categoryId))
    if (params.sectorId) qs.set('sectorId', String(params.sectorId))
    if (params.status) qs.set('status', params.status)
    if (params.sort) qs.set('sort', params.sort)
    if (params.order) qs.set('order', params.order)
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize != null) qs.set('pageSize', String(params.pageSize))
    return request<Paginated<EquipmentListItem>>(`/api/equipment?${qs}`)
  },

  getEquipment: (id: number) =>
    request<EquipmentDetail>(`/api/equipment/${id}`),
  createEquipment: (data: CreateEquipmentInput) =>
    request<EquipmentDetail>('/api/equipment', {
      method: 'POST',
      ...jsonBody(data),
    }),
  updateEquipment: (id: number, data: UpdateEquipmentInput) =>
    request<EquipmentDetail>(`/api/equipment/${id}`, {
      method: 'PATCH',
      ...jsonBody(data),
    }),
  transfer: (id: number, data: TransferInput) =>
    request<EquipmentDetail>(`/api/equipment/${id}/transfer`, {
      method: 'POST',
      ...jsonBody(data),
    }),
  writeOff: (id: number, data: WriteOffInput) =>
    request<EquipmentDetail>(`/api/equipment/${id}/write-off`, {
      method: 'POST',
      ...jsonBody(data),
    }),
  reactivate: (id: number) =>
    request<EquipmentDetail>(`/api/equipment/${id}/reactivate`, {
      method: 'POST',
    }),
  markInUse: (id: number) =>
    request<EquipmentDetail>(`/api/equipment/${id}/in-use`, {
      method: 'POST',
    }),
  deleteEquipment: (id: number, assetTagConfirmation: string) =>
    request<{ ok: boolean }>(`/api/equipment/${id}/delete`, {
      method: 'POST',
      ...jsonBody({ assetTagConfirmation }),
    }),

  listMaintenance: (params: {
    state?: MaintenanceState
    type?: MaintenanceType
    equipmentId?: number
    q?: string
    page?: number
    pageSize?: number
  } = {}) => {
    const qs = new URLSearchParams()
    if (params.state) qs.set('state', params.state)
    if (params.type) qs.set('type', params.type)
    if (params.equipmentId) qs.set('equipmentId', String(params.equipmentId))
    if (params.q) qs.set('q', params.q)
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    return request<Paginated<Maintenance>>(`/api/maintenance?${qs}`)
  },
  openMaintenance: (data: OpenMaintenanceInput) =>
    request<Maintenance>('/api/maintenance', { method: 'POST', ...jsonBody(data) }),
  completeMaintenance: (id: number, data: CompleteMaintenanceInput) =>
    request<Maintenance>(`/api/maintenance/${id}/complete`, {
      method: 'POST',
      ...jsonBody(data),
    }),
  cancelMaintenance: (id: number, data: CancelMaintenanceInput) =>
    request<Maintenance>(`/api/maintenance/${id}/cancel`, {
      method: 'POST',
      ...jsonBody(data),
    }),

  async downloadBackup() {
    const res = await fetch(`${BASE_PATH}/api/backup`)
    if (!res.ok) throw new ApiError('Não foi possível baixar o backup.')
    const blob = await res.blob()
    const cd = res.headers.get('Content-Disposition')
    const match = cd?.match(/filename="(.+)"/)
    const name = match?.[1] ?? 'patrimonio-backup.db'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  },

  async restoreBackup(file: File) {
    const form = new FormData()
    form.append('file', file)
    return request<{ ok: boolean }>('/api/backup', { method: 'POST', body: form })
  },
}
