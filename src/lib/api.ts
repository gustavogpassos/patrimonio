import type {
  Categoria,
  EquipamentoDetalhe,
  EquipamentoListItem,
  Manutencao,
  Paginated,
  PainelData,
  Setor,
  StatusEquipamento,
  SituacaoManutencao,
  TipoManutencao,
} from './types'
import type {
  AbrirManutencaoInput,
  BaixarInput,
  CancelarManutencaoInput,
  CategoriaInput,
  ConcluirManutencaoInput,
  CreateEquipamentoInput,
  SetorInput,
  TransferirInput,
  UpdateEquipamentoInput,
} from './schemas'

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    let message = 'Não foi possível concluir a operação.'
    try {
      const body = (await res.json()) as { erro?: string }
      if (body.erro) message = body.erro
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
  painel: () => request<PainelData>('/api/painel'),

  listSetores: (incluirInativos = false) =>
    request<Setor[]>(`/api/setores?incluirInativos=${incluirInativos}`),
  saveSetor: (data: SetorInput & { id?: number }) =>
    data.id
      ? request<Setor>(`/api/setores/${data.id}`, { method: 'PATCH', ...jsonBody(data) })
      : request<Setor>('/api/setores', { method: 'POST', ...jsonBody(data) }),
  deleteSetor: (id: number) =>
    request<{ ok: boolean }>(`/api/setores/${id}`, { method: 'DELETE' }),

  listCategorias: (incluirInativos = false) =>
    request<Categoria[]>(`/api/categorias?incluirInativos=${incluirInativos}`),
  saveCategoria: (data: CategoriaInput & { id?: number }) =>
    data.id
      ? request<Categoria>(`/api/categorias/${data.id}`, {
          method: 'PATCH',
          ...jsonBody(data),
        })
      : request<Categoria>('/api/categorias', { method: 'POST', ...jsonBody(data) }),
  deleteCategoria: (id: number) =>
    request<{ ok: boolean }>(`/api/categorias/${id}`, { method: 'DELETE' }),

  nextTombamento: () =>
    request<{ tombamento: string }>('/api/equipamentos/proximo-tombamento'),

  listEquipamentos: (params: {
    q?: string
    categoriaId?: number
    setorId?: number
    status?: StatusEquipamento
    sort?: string
    order?: string
    page?: number
    pageSize?: number
  } = {}) => {
    const qs = new URLSearchParams()
    if (params.q) qs.set('q', params.q)
    if (params.categoriaId) qs.set('categoriaId', String(params.categoriaId))
    if (params.setorId) qs.set('setorId', String(params.setorId))
    if (params.status) qs.set('status', params.status)
    if (params.sort) qs.set('sort', params.sort)
    if (params.order) qs.set('order', params.order)
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize != null) qs.set('pageSize', String(params.pageSize))
    return request<Paginated<EquipamentoListItem>>(`/api/equipamentos?${qs}`)
  },

  getEquipamento: (id: number) =>
    request<EquipamentoDetalhe>(`/api/equipamentos/${id}`),
  createEquipamento: (data: CreateEquipamentoInput) =>
    request<EquipamentoDetalhe>('/api/equipamentos', {
      method: 'POST',
      ...jsonBody(data),
    }),
  updateEquipamento: (id: number, data: UpdateEquipamentoInput) =>
    request<EquipamentoDetalhe>(`/api/equipamentos/${id}`, {
      method: 'PATCH',
      ...jsonBody(data),
    }),
  transferir: (id: number, data: TransferirInput) =>
    request<EquipamentoDetalhe>(`/api/equipamentos/${id}/transferir`, {
      method: 'POST',
      ...jsonBody(data),
    }),
  baixar: (id: number, data: BaixarInput) =>
    request<EquipamentoDetalhe>(`/api/equipamentos/${id}/baixar`, {
      method: 'POST',
      ...jsonBody(data),
    }),
  reativar: (id: number) =>
    request<EquipamentoDetalhe>(`/api/equipamentos/${id}/reativar`, {
      method: 'POST',
    }),
  excluir: (id: number, tombamentoConfirmacao: string) =>
    request<{ ok: boolean }>(`/api/equipamentos/${id}/excluir`, {
      method: 'POST',
      ...jsonBody({ tombamentoConfirmacao }),
    }),

  listManutencoes: (params: {
    situacao?: SituacaoManutencao
    tipo?: TipoManutencao
    equipamentoId?: number
    q?: string
    page?: number
    pageSize?: number
  } = {}) => {
    const qs = new URLSearchParams()
    if (params.situacao) qs.set('situacao', params.situacao)
    if (params.tipo) qs.set('tipo', params.tipo)
    if (params.equipamentoId) qs.set('equipamentoId', String(params.equipamentoId))
    if (params.q) qs.set('q', params.q)
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    return request<Paginated<Manutencao>>(`/api/manutencoes?${qs}`)
  },
  abrirManutencao: (data: AbrirManutencaoInput) =>
    request<Manutencao>('/api/manutencoes', { method: 'POST', ...jsonBody(data) }),
  concluirManutencao: (id: number, data: ConcluirManutencaoInput) =>
    request<Manutencao>(`/api/manutencoes/${id}/concluir`, {
      method: 'POST',
      ...jsonBody(data),
    }),
  cancelarManutencao: (id: number, data: CancelarManutencaoInput) =>
    request<Manutencao>(`/api/manutencoes/${id}/cancelar`, {
      method: 'POST',
      ...jsonBody(data),
    }),

  async downloadBackup() {
    const res = await fetch('/api/backup')
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
