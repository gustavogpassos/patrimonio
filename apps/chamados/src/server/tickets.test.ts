import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { hasGroup, seal, sessionCookie } from '@/server/session'

const TEST_SESSION_SECRET = Buffer.from(new Uint8Array(32).fill(7)).toString(
  'base64',
)

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (typeof addr !== 'object' || !addr) {
        server.close()
        reject(new Error('could not bind ephemeral port'))
        return
      }
      const { port } = addr
      server.close((err) => {
        if (err) reject(err)
        else resolve(port)
      })
    })
    server.on('error', reject)
  })
}

async function waitForStdout(
  stream: ReadableStream<Uint8Array>,
  needle: string,
  timeoutMs: number,
): Promise<boolean> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const { value, done } = await Promise.race([
      reader.read(),
      new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) =>
        setTimeout(() => resolve({ value: undefined, done: false }), 100),
      ),
    ])
    if (value) {
      buffer += decoder.decode(value)
      if (buffer.includes(needle)) {
        reader.releaseLock()
        return true
      }
    }
    if (done) break
  }

  reader.releaseLock()
  return buffer.includes(needle)
}

function authCookie(groups: string[], sub: string): string {
  process.env.SESSION_SECRET = TEST_SESSION_SECRET
  const now = Math.floor(Date.now() / 1000)
  return sessionCookie(seal(groups, sub, `${sub}@test`, now)).split(';')[0] ?? ''
}

describe('tickets API', () => {
  let port: number
  let proc: ReturnType<typeof Bun.spawn>
  let dbDir: string

  beforeAll(async () => {
    port = await freePort()
    const dataRoot = join(process.cwd(), 'data', 'test-tmp')
    mkdirSync(dataRoot, { recursive: true })
    dbDir = mkdtempSync(join(dataRoot, 'tickets-'))
    const dbPath = join(dbDir, 'chamados.db')

    const { DATABASE_URL: _db, ...baseEnv } = process.env
    proc = Bun.spawn(['bun', 'src/server/index.ts'], {
      cwd: process.cwd(),
      env: {
        ...baseEnv,
        PORT: String(port),
        CHAMADOS_DB: dbPath,
        SESSION_SECRET: TEST_SESSION_SECRET,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const ready = await waitForStdout(proc.stdout, 'Chamados ouvindo', 20_000)
    if (!ready) {
      const err = await new Response(proc.stderr).text()
      throw new Error(`server did not start: ${err}`)
    }
  }, 30_000)

  afterAll(async () => {
    if (proc) {
      proc.kill()
      await proc.exited
    }
    if (dbDir) {
      rmSync(dbDir, { recursive: true, force: true })
    }
  })

  test('hasGroup chamados-atender requires chamados parent', () => {
    expect(hasGroup(['chamados-atender'], 'chamados-atender')).toBe(false)
    expect(hasGroup(['chamados', 'chamados-atender'], 'chamados-atender')).toBe(
      true,
    )
  })

  test('POST /chamados/api/tickets without cookie returns 401', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/chamados/api/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Falha de rede',
        description: 'Sem acesso',
        priority: 'alta',
      }),
    })
    expect(res.status).toBe(401)
  })

  test('creates ticket as ana', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/chamados/api/tickets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authCookie(['chamados'], 'ana'),
      },
      body: JSON.stringify({
        title: 'Impressora parada',
        description: 'Não imprime',
        priority: 'media',
      }),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { author: string; state: string }
    expect(body.author).toBe('ana')
    expect(body.state).toBe('aberto')
  })

  test('visibility per author and attend group', async () => {
    const createBruno = await fetch(
      `http://127.0.0.1:${port}/chamados/api/tickets`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: authCookie(['chamados'], 'bruno'),
        },
        body: JSON.stringify({
          title: 'VPN',
          description: 'Não conecta',
          priority: 'alta',
        }),
      },
    )
    expect(createBruno.status).toBe(201)

    const anaList = await fetch(
      `http://127.0.0.1:${port}/chamados/api/tickets`,
      { headers: { Cookie: authCookie(['chamados'], 'ana') } },
    )
    const anaBody = (await anaList.json()) as {
      tickets: { author: string }[]
    }
    expect(anaBody.tickets.some((t) => t.author === 'bruno')).toBe(false)
    expect(anaBody.tickets.some((t) => t.author === 'ana')).toBe(true)

    const brunoList = await fetch(
      `http://127.0.0.1:${port}/chamados/api/tickets`,
      { headers: { Cookie: authCookie(['chamados'], 'bruno') } },
    )
    const brunoBody = (await brunoList.json()) as {
      tickets: { author: string }[]
    }
    expect(brunoBody.tickets.some((t) => t.author === 'bruno')).toBe(true)

    const attendList = await fetch(
      `http://127.0.0.1:${port}/chamados/api/tickets`,
      {
        headers: {
          Cookie: authCookie(['chamados', 'chamados-atender'], 'ana'),
        },
      },
    )
    const attendBody = (await attendList.json()) as {
      tickets: { author: string }[]
    }
    expect(attendBody.tickets.some((t) => t.author === 'bruno')).toBe(true)
    expect(attendBody.tickets.some((t) => t.author === 'ana')).toBe(true)
  })

  test('PATCH state permissions', async () => {
    const listRes = await fetch(
      `http://127.0.0.1:${port}/chamados/api/tickets`,
      { headers: { Cookie: authCookie(['chamados'], 'ana') } },
    )
    const listBody = (await listRes.json()) as { tickets: { id: number }[] }
    const ticketId = listBody.tickets.find(() => true)?.id
    expect(ticketId).toBeDefined()

    const forbidden = await fetch(
      `http://127.0.0.1:${port}/chamados/api/tickets/${ticketId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: authCookie(['chamados'], 'ana'),
        },
        body: JSON.stringify({ state: 'em_andamento' }),
      },
    )
    expect(forbidden.status).toBe(403)
    expect(await forbidden.text()).toBe('Sem permissão para atender.')

    const allowed = await fetch(
      `http://127.0.0.1:${port}/chamados/api/tickets/${ticketId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: authCookie(['chamados', 'chamados-atender'], 'ana'),
        },
        body: JSON.stringify({ state: 'em_andamento' }),
      },
    )
    expect(allowed.status).toBe(200)
    const patched = (await allowed.json()) as { state: string }
    expect(patched.state).toBe('em_andamento')
  })

  test('POST comment as ana on her ticket', async () => {
    const listRes = await fetch(
      `http://127.0.0.1:${port}/chamados/api/tickets`,
      { headers: { Cookie: authCookie(['chamados'], 'ana') } },
    )
    const listBody = (await listRes.json()) as { tickets: { id: number }[] }
    const ticketId = listBody.tickets.find(() => true)?.id
    expect(ticketId).toBeDefined()

    const res = await fetch(
      `http://127.0.0.1:${port}/chamados/api/tickets/${ticketId}/comments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: authCookie(['chamados'], 'ana'),
        },
        body: JSON.stringify({ body: 'Atualização do solicitante' }),
      },
    )
    expect(res.status).toBe(201)
    const comment = (await res.json()) as { author: string }
    expect(comment.author).toBe('ana')
  })
})