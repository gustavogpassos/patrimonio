import { join } from 'node:path'
import { BASE_PATH } from '@/base-path'
import {
  cancelMaintenanceSchema,
  categorySchema,
  completeMaintenanceSchema,
  createEquipmentSchema,
  deleteEquipmentSchema,
  openMaintenanceSchema,
  sectorSchema,
  transferSchema,
  updateEquipmentSchema,
  writeOffSchema,
} from '@/lib/schemas'
import { importDatabase, readDatabaseFile } from '@/db/backup'
import { deleteCategory, listCategories, saveCategory } from '@/db/categories'
import { dashboard } from '@/db/dashboard'
import {
  createEquipment,
  deleteEquipment,
  getEquipment,
  listEquipment,
  nextAssetTag,
  markEquipmentInUse,
  reactivateEquipment,
  transferEquipment,
  updateEquipment,
  writeOffEquipment,
} from '@/db/equipment'
import { AppError } from '@/db/errors'
import {
  cancelMaintenance,
  completeMaintenance,
  listMaintenance,
  openMaintenance,
} from '@/db/maintenance'
import { deleteSector, listSectors, saveSector } from '@/db/sectors'
import { openPostgres, usesPostgres } from '@/db/postgres'
import { getDb } from '@/db/sqlite'
import { todayLocal } from '@/lib/dates'
import type { EquipmentStatus } from '@/lib/types'
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

const PORT = Number(process.env.PORT ?? 8787)
const DEFAULT_AUTHENTIK_ISSUER =
  'http://authentik:9000/authentik/application/o/patrimonio/'
const DIST = join(process.cwd(), 'dist')

if (usesPostgres()) {
  await openPostgres(process.env.DATABASE_URL)
} else {
  getDb()
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

function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return json({ error: err.message }, 400)
  }
  console.error(err)
  return json({ error: 'Não foi possível concluir a operação.' }, 500)
}

async function parseJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T
}

function boolParam(value: string | null, defaultValue = false) {
  if (value == null) return defaultValue
  return value === '1' || value === 'true'
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
    !process.env.PATRIMONIO_OIDC_SECRET ||
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
    const redirectUri = `http://${intranetIp}/patrimonio/api/auth/callback`
    const next = safeNext(url.searchParams.get('next') ?? '/')
    const location = authorizationUrl({
      issuer,
      browserOrigin,
      redirectUri,
      state,
      codeChallenge: pkce.challenge,
    })
    const headers = new Headers({ Location: location })
    headers.append('Set-Cookie', auxCookie('patrimonio_next', next))
    headers.append('Set-Cookie', auxCookie('patrimonio_pkce', pkce.verifier))
    headers.append('Set-Cookie', auxCookie('patrimonio_state', state))
    return new Response(null, { status: 302, headers })
  }

  if (path === '/api/auth/callback' && method === 'GET') {
    if (loginConfigMissing()) {
      return new Response('Configuração de login ausente.', { status: 500 })
    }
    const cookies = req.headers.get('cookie')
    const savedState = cookieValue(cookies, 'patrimonio_state')
    const verifier = cookieValue(cookies, 'patrimonio_pkce')
    const nextRaw = cookieValue(cookies, 'patrimonio_next')
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
    const redirectUri = `http://${intranetIp}/patrimonio/api/auth/callback`
    const tokenUrl = new URL('token/', issuer.endsWith('/') ? issuer : `${issuer}/`)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: 'patrimonio',
      client_secret: process.env.PATRIMONIO_OIDC_SECRET!,
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
    headers.append('Set-Cookie', clearAuxCookie('patrimonio_next'))
    headers.append('Set-Cookie', clearAuxCookie('patrimonio_pkce'))
    headers.append('Set-Cookie', clearAuxCookie('patrimonio_state'))
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

async function handleApi(req: Request, url: URL): Promise<Response> {
  const path = url.pathname
  const method = req.method

  try {
    if (path === '/api/dashboard' && method === 'GET') {
      return json(await dashboard())
    }

    if (path === '/api/sectors' && method === 'GET') {
      return json(await listSectors(boolParam(url.searchParams.get('includeInactive'))))
    }
    if (path === '/api/sectors' && method === 'POST') {
      const body = sectorSchema.parse(await parseJson(req))
      return json(await saveSector(body), 201)
    }
    {
      const match = /^\/api\/sectors\/(\d+)$/.exec(path)
      if (match && method === 'PATCH') {
        const body = sectorSchema.parse(await parseJson(req))
        return json(await saveSector({ ...body, id: Number(match[1]) }))
      }
      if (match && method === 'DELETE') {
        await deleteSector(Number(match[1]))
        return json({ ok: true })
      }
    }

    if (path === '/api/categories' && method === 'GET') {
      return json(await listCategories(boolParam(url.searchParams.get('includeInactive'))))
    }
    if (path === '/api/categories' && method === 'POST') {
      const body = categorySchema.parse(await parseJson(req))
      return json(await saveCategory(body), 201)
    }
    {
      const match = /^\/api\/categories\/(\d+)$/.exec(path)
      if (match && method === 'PATCH') {
        const body = categorySchema.parse(await parseJson(req))
        return json(await saveCategory({ ...body, id: Number(match[1]) }))
      }
      if (match && method === 'DELETE') {
        await deleteCategory(Number(match[1]))
        return json({ ok: true })
      }
    }

    if (path === '/api/equipment/next-asset-tag' && method === 'GET') {
      return json({ assetTag: await nextAssetTag() })
    }

    if (path === '/api/equipment' && method === 'GET') {
      const status = url.searchParams.get('status') as EquipmentStatus | null
      return json(
        await listEquipment({
          q: url.searchParams.get('q') ?? undefined,
          categoryId: url.searchParams.get('categoryId')
            ? Number(url.searchParams.get('categoryId'))
            : undefined,
          sectorId: url.searchParams.get('sectorId')
            ? Number(url.searchParams.get('sectorId'))
            : undefined,
          status: status || undefined,
          sort: (url.searchParams.get('sort') as 'assetTag' | 'name' | 'status') || 'assetTag',
          order: (url.searchParams.get('order') as 'asc' | 'desc') || 'desc',
          page: url.searchParams.get('page')
            ? Number(url.searchParams.get('page'))
            : 1,
          pageSize: url.searchParams.get('pageSize')
            ? Number(url.searchParams.get('pageSize'))
            : 20,
        }),
      )
    }

    if (path === '/api/equipment' && method === 'POST') {
      const body = createEquipmentSchema.parse(await parseJson(req))
      return json(await createEquipment(body), 201)
    }

    {
      const match = /^\/api\/equipment\/(\d+)$/.exec(path)
      if (match && method === 'GET') {
        return json(await getEquipment(Number(match[1])))
      }
      if (match && method === 'PATCH') {
        const body = updateEquipmentSchema.parse(await parseJson(req))
        return json(await updateEquipment(Number(match[1]), body))
      }
    }

    {
      const match = /^\/api\/equipment\/(\d+)\/transfer$/.exec(path)
      if (match && method === 'POST') {
        const body = transferSchema.parse(await parseJson(req))
        return json(await transferEquipment(Number(match[1]), body))
      }
    }
    {
      const match = /^\/api\/equipment\/(\d+)\/write-off$/.exec(path)
      if (match && method === 'POST') {
        const body = writeOffSchema.parse(await parseJson(req))
        return json(await writeOffEquipment(Number(match[1]), body))
      }
    }
    {
      const match = /^\/api\/equipment\/(\d+)\/reactivate$/.exec(path)
      if (match && method === 'POST') {
        return json(await reactivateEquipment(Number(match[1])))
      }
    }
    {
      const match = /^\/api\/equipment\/(\d+)\/in-use$/.exec(path)
      if (match && method === 'POST') {
        return json(await markEquipmentInUse(Number(match[1])))
      }
    }
    {
      const match = /^\/api\/equipment\/(\d+)\/delete$/.exec(path)
      if (match && method === 'POST') {
        const body = deleteEquipmentSchema.parse(await parseJson(req))
        await deleteEquipment(Number(match[1]), body.assetTagConfirmation)
        return json({ ok: true })
      }
    }

    if (path === '/api/maintenance' && method === 'GET') {
      return json(
        await listMaintenance({
          state: (url.searchParams.get('state') as never) || undefined,
          type: (url.searchParams.get('type') as never) || undefined,
          equipmentId: url.searchParams.get('equipmentId')
            ? Number(url.searchParams.get('equipmentId'))
            : undefined,
          q: url.searchParams.get('q') ?? undefined,
          page: url.searchParams.get('page')
            ? Number(url.searchParams.get('page'))
            : 1,
          pageSize: url.searchParams.get('pageSize')
            ? Number(url.searchParams.get('pageSize'))
            : 20,
        }),
      )
    }

    if (path === '/api/maintenance' && method === 'POST') {
      const body = openMaintenanceSchema.parse(await parseJson(req))
      return json(await openMaintenance(body), 201)
    }
    {
      const match = /^\/api\/maintenance\/(\d+)\/complete$/.exec(path)
      if (match && method === 'POST') {
        const body = completeMaintenanceSchema.parse(await parseJson(req))
        return json(await completeMaintenance(Number(match[1]), body))
      }
    }
    {
      const match = /^\/api\/maintenance\/(\d+)\/cancel$/.exec(path)
      if (match && method === 'POST') {
        const body = cancelMaintenanceSchema.parse(await parseJson(req))
        return json(await cancelMaintenance(Number(match[1]), body))
      }
    }

    if (path === '/api/backup' && method === 'GET') {
      const bytes = await readDatabaseFile()
      const name = `patrimonio-backup-${todayLocal()}.db`
      return new Response(new Blob([Uint8Array.from(bytes)]), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${name}"`,
        },
      })
    }

    if (path === '/api/backup' && method === 'POST') {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File)) {
        throw new AppError('Arquivo não é um banco do Patrimônio.')
      }
      const bytes = new Uint8Array(await file.arrayBuffer())
      await importDatabase(bytes)
      return json({ ok: true })
    }

    return json({ error: 'Rota não encontrada.' }, 404)
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      return json({ error: 'Dados inválidos.' }, 400)
    }
    return errorResponse(err)
  }
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
          'patrimonio_session',
        )
        const now = Math.floor(Date.now() / 1000)
        const session = sessionToken ? open(sessionToken, now) : null
        if (!session || !hasGroup(session.groups, 'patrimonio')) {
          return new Response('Não autorizado.', { status: 401 })
        }
      }

      return handleApi(req, url)
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

console.log(`Patrimônio ouvindo em http://0.0.0.0:${PORT}`)
