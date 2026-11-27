import { BASE_PATH } from '@/base-path'

export type TicketState =
  | 'aberto'
  | 'em_andamento'
  | 'resolvido'
  | 'cancelado'

export type TicketPriority = 'baixa' | 'media' | 'alta'

export type Comment = {
  id: number
  ticket_id: number
  author: string
  body: string
  created_at: string
}

export type Ticket = {
  id: number
  title: string
  description: string
  state: TicketState
  priority: TicketPriority
  assignee: string | null
  author: string
  created_at: string
  comments: Comment[]
}

export type TicketsResponse = {
  tickets: Ticket[]
  canAttend: boolean
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_PATH}${path}`
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
      throw new Error('Não autorizado.')
    }
    const message = await res.text()
    throw new Error(message || 'Não foi possível concluir a operação.')
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

function jsonBody(data: unknown): RequestInit {
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
}

export const api = {
  listTickets: () => request<TicketsResponse>('/api/tickets'),
  createTicket: (data: {
    title: string
    description: string
    priority: TicketPriority
  }) =>
    request<Ticket>('/api/tickets', { method: 'POST', ...jsonBody(data) }),
  updateTicket: (id: number, data: { state?: TicketState; assignee?: string | null }) =>
    request<Ticket>(`/api/tickets/${id}`, {
      method: 'PATCH',
      ...jsonBody(data),
    }),
  addComment: (id: number, body: string) =>
    request<Comment>(`/api/tickets/${id}/comments`, {
      method: 'POST',
      ...jsonBody({ body }),
    }),
}