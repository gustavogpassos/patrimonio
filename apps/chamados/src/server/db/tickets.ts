import type { Database } from 'bun:sqlite'
import { getPostgres } from './postgres'
import { getSqlite } from './sqlite'

export const TICKET_STATES = [
  'aberto',
  'em_andamento',
  'resolvido',
  'cancelado',
] as const

export const TICKET_PRIORITIES = ['baixa', 'media', 'alta'] as const

export type TicketState = (typeof TICKET_STATES)[number]
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export type CommentRow = {
  id: number
  ticket_id: number
  author: string
  body: string
  created_at: string
}

export type TicketRow = {
  id: number
  title: string
  description: string
  state: TicketState
  priority: TicketPriority
  assignee: string | null
  author: string
  created_at: string
}

export type TicketWithComments = TicketRow & { comments: CommentRow[] }

function usePostgres(): boolean {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.DATABASE_URL.length > 0 &&
      !process.env.CHAMADOS_DB,
  )
}

function mapTicket(row: Record<string, unknown>): TicketRow {
  return {
    id: Number(row.id),
    title: String(row.title),
    description: String(row.description),
    state: String(row.state) as TicketState,
    priority: String(row.priority) as TicketPriority,
    assignee: row.assignee == null ? null : String(row.assignee),
    author: String(row.author),
    created_at: String(row.created_at),
  }
}

function mapComment(row: Record<string, unknown>): CommentRow {
  return {
    id: Number(row.id),
    ticket_id: Number(row.ticket_id),
    author: String(row.author),
    body: String(row.body),
    created_at: String(row.created_at),
  }
}

function commentsForTicketsSqlite(
  connection: Database,
  ticketIds: number[],
): Map<number, CommentRow[]> {
  const map = new Map<number, CommentRow[]>()
  if (ticketIds.length === 0) return map
  for (const id of ticketIds) {
    map.set(id, [])
  }
  const placeholders = ticketIds.map(() => '?').join(', ')
  const stmt = connection.prepare(
    `SELECT id, ticket_id, author, body, created_at FROM comments WHERE ticket_id IN (${placeholders}) ORDER BY id ASC`,
  )
  const rows = stmt.all(...ticketIds) as Record<string, unknown>[]
  for (const row of rows) {
    const comment = mapComment(row)
    const list = map.get(comment.ticket_id) ?? []
    list.push(comment)
    map.set(comment.ticket_id, list)
  }
  return map
}

function commentsForTicketSqlite(
  connection: Database,
  ticketId: number,
): CommentRow[] {
  const stmt = connection.prepare(
    'SELECT id, ticket_id, author, body, created_at FROM comments WHERE ticket_id = ? ORDER BY id ASC',
  )
  return (stmt.all(ticketId) as Record<string, unknown>[]).map(mapComment)
}

export async function createTicket(input: {
  title: string
  description: string
  priority: TicketPriority
  author: string
}): Promise<TicketWithComments> {
  const createdAt = new Date().toISOString()
  if (usePostgres()) {
    const sql = getPostgres()
    const rows = await sql`
      INSERT INTO tickets (title, description, state, priority, assignee, author, created_at)
      VALUES (${input.title}, ${input.description}, 'aberto', ${input.priority}, NULL, ${input.author}, ${createdAt})
      RETURNING id, title, description, state, priority, assignee, author, created_at
    `
    const row = Array.isArray(rows) ? rows[0] : rows
    const ticket = mapTicket(row as Record<string, unknown>)
    return { ...ticket, comments: [] }
  }

  const connection = getSqlite()
  const stmt = connection.prepare(`
    INSERT INTO tickets (title, description, state, priority, assignee, author, created_at)
    VALUES (?, ?, 'aberto', ?, NULL, ?, ?)
  `)
  const result = stmt.run(
    input.title,
    input.description,
    input.priority,
    input.author,
    createdAt,
  )
  const id = Number(result.lastInsertRowid)
  const ticket = connection
    .prepare(
      'SELECT id, title, description, state, priority, assignee, author, created_at FROM tickets WHERE id = ?',
    )
    .get(id) as Record<string, unknown>
  return { ...mapTicket(ticket), comments: [] }
}

export async function listTickets(
  authorFilter?: string,
): Promise<TicketWithComments[]> {
  if (usePostgres()) {
    const sql = getPostgres()
    const rows = authorFilter
      ? await sql`
          SELECT id, title, description, state, priority, assignee, author, created_at
          FROM tickets
          WHERE author = ${authorFilter}
          ORDER BY id ASC
        `
      : await sql`
          SELECT id, title, description, state, priority, assignee, author, created_at
          FROM tickets
          ORDER BY id ASC
        `
    const ticketRows = (Array.isArray(rows) ? rows : []) as Record<
      string,
      unknown
    >[]
    const tickets = ticketRows.map(mapTicket)
    const idSet = new Set(tickets.map((t) => t.id))
    const commentsByTicket = new Map<number, CommentRow[]>()
    for (const id of idSet) commentsByTicket.set(id, [])
    if (idSet.size > 0) {
      const commentRows = await sql`
        SELECT id, ticket_id, author, body, created_at
        FROM comments
        ORDER BY id ASC
      `
      for (const row of (Array.isArray(commentRows) ? commentRows : []) as Record<
        string,
        unknown
      >[]) {
        const comment = mapComment(row)
        if (!idSet.has(comment.ticket_id)) continue
        const list = commentsByTicket.get(comment.ticket_id) ?? []
        list.push(comment)
        commentsByTicket.set(comment.ticket_id, list)
      }
    }
    return tickets.map((ticket) => ({
      ...ticket,
      comments: commentsByTicket.get(ticket.id) ?? [],
    }))
  }

  const connection = getSqlite()
  const rows = authorFilter
    ? (connection
        .prepare(
          'SELECT id, title, description, state, priority, assignee, author, created_at FROM tickets WHERE author = ? ORDER BY id ASC',
        )
        .all(authorFilter) as Record<string, unknown>[])
    : (connection
        .prepare(
          'SELECT id, title, description, state, priority, assignee, author, created_at FROM tickets ORDER BY id ASC',
        )
        .all() as Record<string, unknown>[])
  const tickets = rows.map(mapTicket)
  const commentsMap = commentsForTicketsSqlite(
    connection,
    tickets.map((t) => t.id),
  )
  return tickets.map((ticket) => ({
    ...ticket,
    comments: commentsMap.get(ticket.id) ?? [],
  }))
}

export async function getTicketById(id: number): Promise<TicketRow | null> {
  if (usePostgres()) {
    const sql = getPostgres()
    const rows = await sql`
      SELECT id, title, description, state, priority, assignee, author, created_at
      FROM tickets
      WHERE id = ${id}
    `
    const row = Array.isArray(rows) ? rows[0] : rows
    if (!row) return null
    return mapTicket(row as Record<string, unknown>)
  }

  const connection = getSqlite()
  const row = connection
    .prepare(
      'SELECT id, title, description, state, priority, assignee, author, created_at FROM tickets WHERE id = ?',
    )
    .get(id) as Record<string, unknown> | null
  if (!row) return null
  return mapTicket(row)
}

export async function updateTicket(
  id: number,
  patch: { state?: TicketState; assignee?: string | null },
): Promise<TicketWithComments | null> {
  const existing = await getTicketById(id)
  if (!existing) return null

  const state = patch.state ?? existing.state
  const assignee =
    patch.assignee !== undefined ? patch.assignee : existing.assignee

  if (usePostgres()) {
    const sql = getPostgres()
    await sql`
      UPDATE tickets
      SET state = ${state}, assignee = ${assignee}
      WHERE id = ${id}
    `
    const updated = await getTicketById(id)
    if (!updated) return null
    const commentRows = await sql`
      SELECT id, ticket_id, author, body, created_at
      FROM comments
      WHERE ticket_id = ${id}
      ORDER BY id ASC
    `
    const comments = (
      Array.isArray(commentRows) ? commentRows : []
    ).map((row) => mapComment(row as Record<string, unknown>))
    return { ...updated, comments }
  }

  const connection = getSqlite()
  connection
    .prepare('UPDATE tickets SET state = ?, assignee = ? WHERE id = ?')
    .run(state, assignee, id)
  const updated = await getTicketById(id)
  if (!updated) return null
  return {
    ...updated,
    comments: commentsForTicketSqlite(connection, id),
  }
}

export async function addComment(
  ticketId: number,
  author: string,
  body: string,
): Promise<CommentRow | null> {
  if (!(await getTicketById(ticketId))) return null
  const createdAt = new Date().toISOString()

  if (usePostgres()) {
    const sql = getPostgres()
    const rows = await sql`
      INSERT INTO comments (ticket_id, author, body, created_at)
      VALUES (${ticketId}, ${author}, ${body}, ${createdAt})
      RETURNING id, ticket_id, author, body, created_at
    `
    const row = Array.isArray(rows) ? rows[0] : rows
    return mapComment(row as Record<string, unknown>)
  }

  const connection = getSqlite()
  const result = connection
    .prepare(
      'INSERT INTO comments (ticket_id, author, body, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(ticketId, author, body, createdAt)
  const id = Number(result.lastInsertRowid)
  const row = connection
    .prepare(
      'SELECT id, ticket_id, author, body, created_at FROM comments WHERE id = ?',
    )
    .get(id) as Record<string, unknown>
  return mapComment(row)
}