import { join } from 'node:path'
import { BASE_PATH } from '@/base-path'
import {
  addComment,
  createTicket,
  getTicketById,
  listTickets,
  TICKET_PRIORITIES,
  TICKET_STATES,
  updateTicket,
  type TicketPriority,
  type TicketState,
} from '@/server/db/tickets'
import { openPostgres } from '@/server/db/postgres'
import { getSqlite } from '@/server/db/sqlite'
import {
  auxCookie,
  authorizationUrl,
  clearAuxCookie,
  clearSessionCookie,
  createPkce,
  hasGroup,
  open,
  randomState,
  readIdToken,
  safeNext,
  seal,
  sessionCookie,
  sessionSecretValid,
} from '@/server/session'

const PORT = Number(process.env.PORT ?? 8788)
const DEFAULT_AUTHENTIK_ISSUER =
  'http://authentik:9000/authentik/application/o/chamados/'
const DIST = join(process.cwd(), 'dist')

if (process.env.DATABASE_URL && !process.env.CHAMADOS_DB) {
  await openPostgres(process.env.DATABASE_URL)
} else {
  getSqlite()
}

function stripBase(pathname: string): string | null {
  if (pathname === BASE_PATH || pathname.startsWith(`${BASE_PATH}/`)) {
    const rest = pathname.slice(BASE_PATH.length)
    return rest.length === 0 ? '/' : rest
  }
  return null
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

async function parseJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T
}

function cookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    if (key === name) return trimmed.slice(eq + 1)
  }
  return undefined
}

function loginConfigMissing(): boolean {
  return (
    !process.env.INTRANET_IP ||
    !process.env.AUTHENTIK_BROWSER_URL ||
    !process.env.CHAMADOS_OIDC_SECRET ||
    !sessionSecretValid()
  )
}

async function handleAuth(req: Request, url: URL): Promise<Response | null> {
  const path = url.pathname
  const method = req.method

  if (path === '/api/auth/login' && method === 'GET') {
    if (loginConfigMissing()) {
      return new Response('Configuração de login ausente.', { status: 500 })
    }
    const pkce = createPkce()
    const state = randomState()
    const intranetIp = process.env.INTRANET_IP!
    const issuer = process.env.AUTHENTIK_ISSUER ?? DEFAULT_AUTHENTIK_ISSUER
    const browserOrigin = new URL(process.env.AUTHENTIK_BROWSER_URL!).origin
    const redirectUri = `http://${intranetIp}/chamados/api/auth/callback`
    const next = safeNext(url.searchParams.get('next') ?? '/')
    const location = authorizationUrl({
      issuer,
      browserOrigin,
      redirectUri,
      state,
      codeChallenge: pkce.challenge,
    })
    const headers = new Headers({ Location: location })
    headers.append('Set-Cookie', auxCookie('chamados_next', next))
    headers.append('Set-Cookie', auxCookie('chamados_pkce', pkce.verifier))
    headers.append('Set-Cookie', auxCookie('chamados_state', state))
    return new Response(null, { status: 302, headers })
  }

  if (path === '/api/auth/callback' && method === 'GET') {
    if (loginConfigMissing()) {
      return new Response('Configuração de login ausente.', { status: 500 })
    }
    const cookies = req.headers.get('cookie')
    const savedState = cookieValue(cookies, 'chamados_state')
    const verifier = cookieValue(cookies, 'chamados_pkce')
    const nextRaw = cookieValue(cookies, 'chamados_next')
    const queryState = url.searchParams.get('state')
    const code = url.searchParams.get('code')
    if (
      !queryState ||
      !code ||
      !savedState ||
      !verifier ||
      queryState !== savedState
    ) {
      return new Response('Login inválido.', { status: 400 })
    }
    const intranetIp = process.env.INTRANET_IP!
    const issuer = process.env.AUTHENTIK_ISSUER ?? DEFAULT_AUTHENTIK_ISSUER
    const redirectUri = `http://${intranetIp}/chamados/api/auth/callback`
    const tokenUrl = new URL('token/', issuer.endsWith('/') ? issuer : `${issuer}/`)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: 'chamados',
      client_secret: process.env.CHAMADOS_OIDC_SECRET!,
      code_verifier: verifier,
    })
    let tokenRes: Response
    try {
      tokenRes = await fetch(tokenUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      })
    } catch {
      return new Response('Não foi possível concluir o login.', { status: 502 })
    }
    if (!tokenRes.ok) {
      return new Response('Não foi possível concluir o login.', { status: 502 })
    }
    let tokenJson: { id_token?: unknown }
    try {
      tokenJson = (await tokenRes.json()) as { id_token?: unknown }
    } catch {
      return new Response('Não foi possível concluir o login.', { status: 502 })
    }
    if (typeof tokenJson.id_token !== 'string') {
      return new Response('Não foi possível concluir o login.', { status: 502 })
    }
    const claims = readIdToken(tokenJson.id_token)
    if (!claims) {
      return new Response('Não foi possível concluir o login.', { status: 502 })
    }
    const now = Math.floor(Date.now() / 1000)
    let token: string
    try {
      token = seal(claims.groups, claims.sub, claims.email, now)
    } catch {
      return new Response('Configuração de login ausente.', { status: 500 })
    }
    const next = safeNext(nextRaw ?? '/')
    const headers = new Headers({
      Location: `${BASE_PATH}${next}`,
    })
    headers.append('Set-Cookie', sessionCookie(token))
    headers.append('Set-Cookie', clearAuxCookie('chamados_next'))
    headers.append('Set-Cookie', clearAuxCookie('chamados_pkce'))
    headers.append('Set-Cookie', clearAuxCookie('chamados_state'))
    return new Response(null, { status: 302, headers })
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const headers = new Headers()
    headers.append('Set-Cookie', clearSessionCookie())
    return new Response(null, { status: 204, headers })
  }

  return null
}

function isAuthRoute(path: string): boolean {
  return (
    path === '/api/auth/login' ||
    path === '/api/auth/callback' ||
    path === '/api/auth/logout'
  )
}

type Session = { groups: string[]; sub: string; email: string }

async function handleApi(
  req: Request,
  url: URL,
  session: Session,
): Promise<Response> {
  const path = url.pathname
  const method = req.method

  if (path === '/api/tickets' && method === 'POST') {
    const body = await parseJson<{
      title?: string
      description?: string
      priority?: string
    }>(req)
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description =
      typeof body.description === 'string' ? body.description.trim() : ''
    if (!title || !description) {
      return new Response('Título e descrição são obrigatórios.', { status: 400 })
    }
    const priority = body.priority
    if (
      typeof priority !== 'string' ||
      !TICKET_PRIORITIES.includes(priority as TicketPriority)
    ) {
      return new Response('Prioridade inválida.', { status: 400 })
    }
    const ticket = await createTicket({
      title,
      description,
      priority: priority as TicketPriority,
      author: session.sub,
    })
    return json(ticket, 201)
  }

  if (path === '/api/tickets' && method === 'GET') {
    const canAttend = hasGroup(session.groups, 'chamados-atender')
    const tickets = canAttend
      ? await listTickets()
      : await listTickets(session.sub)
    return json({ tickets, canAttend })
  }

  {
    const match = /^\/api\/tickets\/(\d+)$/.exec(path)
    if (match && method === 'PATCH') {
      if (!hasGroup(session.groups, 'chamados-atender')) {
        return new Response('Sem permissão para atender.', { status: 403 })
      }
      const id = Number(match[1])
      const body = await parseJson<{ state?: string; assignee?: unknown }>(req)
      const patch: { state?: TicketState; assignee?: string | null } = {}
      if (body.state !== undefined) {
        if (
          typeof body.state !== 'string' ||
          !TICKET_STATES.includes(body.state as TicketState)
        ) {
          return new Response('Estado inválido.', { status: 400 })
        }
        patch.state = body.state as TicketState
      }
      if ('assignee' in body) {
        if (body.assignee === null || body.assignee === '') {
          patch.assignee = null
        } else if (typeof body.assignee === 'string') {
          patch.assignee = body.assignee
        }
      }
      const updated = await updateTicket(id, patch)
      if (!updated) {
        return new Response('Chamado não encontrado.', { status: 404 })
      }
      return json(updated)
    }
  }

  {
    const match = /^\/api\/tickets\/(\d+)\/comments$/.exec(path)
    if (match && method === 'POST') {
      const id = Number(match[1])
      const ticket = await getTicketById(id)
      if (!ticket) {
        return new Response('Chamado não encontrado.', { status: 404 })
      }
      if (
        !hasGroup(session.groups, 'chamados-atender') &&
        ticket.author !== session.sub
      ) {
        return new Response('Chamado não encontrado.', { status: 404 })
      }
      const body = await parseJson<{ body?: string }>(req)
      const text = typeof body.body === 'string' ? body.body.trim() : ''
      if (!text) {
        return new Response('Comentário vazio.', { status: 400 })
      }
      const comment = await addComment(id, session.sub, text)
      if (!comment) {
        return new Response('Chamado não encontrado.', { status: 404 })
      }
      return json(comment, 201)
    }
  }

  return new Response('Not Found', { status: 404 })
}

async function serveStatic(pathname: string): Promise<Response | null> {
  const clean = pathname === '/' ? '/index.html' : pathname
  const filePath = join(DIST, clean)
  const file = Bun.file(filePath)
  if (await file.exists()) {
    return new Response(file)
  }
  return null
}

Bun.serve({
  hostname: '0.0.0.0',
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)
    const stripped = stripBase(url.pathname)
    if (stripped === null) {
      return new Response('Not Found', { status: 404 })
    }
    url.pathname = stripped

    if (stripped.startsWith('/api/')) {
      const authResponse = await handleAuth(req, url)
      if (authResponse) return authResponse

      if (!isAuthRoute(url.pathname)) {
        const sessionToken = cookieValue(
          req.headers.get('cookie'),
          'chamados_session',
        )
        const now = Math.floor(Date.now() / 1000)
        const session = sessionToken ? open(sessionToken, now) : null
        if (!session || !hasGroup(session.groups, 'chamados')) {
          return new Response('Não autorizado.', { status: 401 })
        }
        return handleApi(req, url, session)
      }

      return new Response('Not Found', { status: 404 })
    }

    const staticResponse = await serveStatic(stripped)
    if (staticResponse) return staticResponse

    const index = Bun.file(join(DIST, 'index.html'))
    if (await index.exists()) {
      return new Response(index)
    }

    return new Response(
      'Interface ainda não foi gerada. Rode bun run build ou use bun run dev.',
      { status: 503 },
    )
  },
})

console.log(`Chamados ouvindo em http://0.0.0.0:${PORT}`)