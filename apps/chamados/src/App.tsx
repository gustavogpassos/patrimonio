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

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
      <h1>Chamados</h1>

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
                {ticket.title} — {STATE_LABELS[ticket.state]}
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
                    {canAttend ? (
                      <label>
                        Estado
                        <select
                          value={ticket.state}
                          onChange={(e) =>
                            void onStateChange(
                              ticket.id,
                              e.target.value as TicketState,
                            )
                          }
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