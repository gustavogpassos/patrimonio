import { BASE_PATH } from '@/base-path'
import {
  api,
  type Ticket,
  type TicketPriority,
  type TicketState,
} from '@/lib/api'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

const STATE_LABELS: Record<TicketState, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
  cancelado: 'Cancelado',
}

const STATE_COLUMNS: { key: TicketState; label: string }[] = [
  { key: 'aberto', label: 'Aberto' },
  { key: 'em_andamento', label: 'Em andamento' },
  { key: 'resolvido', label: 'Resolvido' },
  { key: 'cancelado', label: 'Cancelado' },
]

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
]

function TicketBody({
  ticket,
  canAttend,
  onChanged,
  onError,
  onStateChange,
}: {
  ticket: Ticket
  canAttend: boolean
  onChanged: () => void
  onError: (message: string) => void
  onStateChange?: (id: number, state: TicketState) => void
}) {
  const [assignee, setAssignee] = useState(ticket.assignee ?? '')
  const [comment, setComment] = useState('')

  async function defineAssignee() {
    try {
      const value = assignee.trim()
      await api.updateTicket(ticket.id, { assignee: value === '' ? null : value })
      onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao definir responsável.')
    }
  }

  async function sendComment() {
    try {
      await api.addComment(ticket.id, comment)
      setComment('')
      onChanged()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Erro ao comentar.')
    }
  }

  return (
    <div>
      <div>
        {ticket.title} — {STATE_LABELS[ticket.state]}
      </div>
      <p style={{ margin: '0.35rem 0' }}>Prioridade: {ticket.priority}</p>
      <p style={{ margin: '0.35rem 0' }}>Autor: {ticket.author}</p>
      <p style={{ margin: '0.35rem 0' }}>Responsável: {ticket.assignee ?? ''}</p>
      {ticket.comments.length > 0 ? (
        <ul>
          {ticket.comments.map((item) => (
            <li key={item.id}>
              {item.author}: {item.body}
            </li>
          ))}
        </ul>
      ) : null}
      {canAttend ? (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <input
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            aria-label="Responsável"
            style={{ flex: 1 }}
          />
          <button type="button" onClick={() => void defineAssignee()}>
            Definir responsável
          </button>
        </div>
      ) : null}
      {onStateChange ? (
        <label>
          Estado
          <select
            value={ticket.state}
            onChange={(e) => void onStateChange(ticket.id, e.target.value as TicketState)}
            style={{ display: 'block', marginTop: 4 }}
          >
            {STATE_COLUMNS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          aria-label="Comentário"
        />
        <button type="button" onClick={() => void sendComment()}>
          Comentar
        </button>
      </div>
    </div>
  )
}

function ChamadosPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [canAttend, setCanAttend] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('media')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.listTickets()
      setTickets(data.tickets)
      setCanAttend(data.canAttend)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await api.createTicket({ title, description, priority })
      setTitle('')
      setDescription('')
      setPriority('media')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir chamado.')
    }
  }

  async function onStateChange(id: number, state: TicketState) {
    try {
      await api.updateTicket(id, { state })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar.')
    }
  }

  async function onLogout() {
    await fetch('/chamados/api/auth/logout', { method: 'POST' })
    location.assign('/chamados/')
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Chamados</h1>
        <button type="button" onClick={() => void onLogout()}>
          Sair
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '0.75rem', marginBottom: '2rem' }}>
        <label>
          Título
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Descrição
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <label>
          Prioridade
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as TicketPriority)}
            style={{ display: 'block', marginTop: 4 }}
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Abrir chamado</button>
      </form>

      {error ? <p role="alert">{error}</p> : null}
      {loading ? <p>Carregando…</p> : null}

      <section style={{ marginBottom: '2rem' }}>
        <h2>Lista</h2>
        {tickets.length === 0 ? (
          <p>Nenhum chamado.</p>
        ) : (
          <ul>
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <TicketBody
                  ticket={ticket}
                  canAttend={canAttend}
                  onChanged={() => void load()}
                  onError={setError}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
        }}
      >
        {STATE_COLUMNS.map((col) => (
          <div key={col.key}>
            <h3>{col.label}</h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {tickets
                .filter((ticket) => ticket.state === col.key)
                .map((ticket) => (
                  <article
                    key={ticket.id}
                    style={{
                      border: '1px solid #ccc',
                      borderRadius: 8,
                      padding: '0.75rem',
                    }}
                  >
                    <strong>{ticket.title}</strong>
                    <p style={{ margin: '0.35rem 0' }}>{ticket.description}</p>
                    <TicketBody
                      ticket={ticket}
                      canAttend={canAttend}
                      onChanged={() => void load()}
                      onError={setError}
                      onStateChange={onStateChange}
                    />
                  </article>
                ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={BASE_PATH}>
      <Routes>
        <Route index element={<ChamadosPage />} />
      </Routes>
    </BrowserRouter>
  )
}