import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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

describe('base path /patrimonio', () => {
  let port: number
  let proc: ReturnType<typeof Bun.spawn>
  let dbDir: string

  beforeAll(async () => {
    port = await freePort()
    const dataRoot = join(process.cwd(), 'data', 'test-tmp')
    mkdirSync(dataRoot, { recursive: true })
    dbDir = mkdtempSync(join(dataRoot, 'base-path-'))
    const dbPath = join(dbDir, 'patrimonio.db')

    proc = Bun.spawn(['bun', 'src/server/index.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        PATRIMONIO_DB: dbPath,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const ready = await waitForStdout(proc.stdout, 'Patrimônio ouvindo', 20_000)
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

  test('GET /patrimonio/api/dashboard returns 200', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/patrimonio/api/dashboard`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toContain('application/json')
    const body = (await res.json()) as { activeCount?: unknown }
    expect(typeof body.activeCount).toBe('number')
  })

  test('GET /api/dashboard without prefix returns 404', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/dashboard`)
    expect(res.status).toBe(404)
  })
})