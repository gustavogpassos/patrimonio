import { SQL } from 'bun'
import { expect, test } from 'bun:test'

const databaseUrl = process.env.DATABASE_URL

const SEED = [
  'Computador',
  'Notebook',
  'Monitor',
  'Roteador',
  'Switch',
  'Impressora',
  'Nobreak',
  'Periférico',
  'Outro',
]

if (!databaseUrl) {
  test.skip('Postgres ausente: defina DATABASE_URL', () => {})
} else {
  test(
    'lista as categorias iniciais no Postgres',
    async () => {
      const lock = new SQL(databaseUrl)
      const reserved = await lock.reserve()
      try {
        await reserved.unsafe('SELECT pg_advisory_lock(871234)')
        const proc = Bun.spawn(
          [
            'bun',
            '-e',
            `
              const { openPostgres, closePostgres } = await import('./src/db/postgres.ts')
              const { listCategories } = await import('./src/db/categories.ts')
              await openPostgres(process.env.DATABASE_URL)
              const names = (await listCategories(true)).map((row) => row.name)
              console.log(JSON.stringify(names))
              await closePostgres()
            `,
          ],
          {
            cwd: process.cwd(),
            env: {
              ...process.env,
              DATABASE_URL: databaseUrl,
              PATRIMONIO_DB: '',
            },
            stdout: 'pipe',
            stderr: 'pipe',
          },
        )
        const stdout = await new Response(proc.stdout).text()
        const stderr = await new Response(proc.stderr).text()
        const code = await proc.exited
        if (code !== 0) {
          throw new Error(stderr || stdout)
        }
        const line = stdout.trim().split('\n').filter(Boolean).at(-1) ?? '[]'
        const names = JSON.parse(line) as string[]
        for (const name of SEED) {
          expect(names).toContain(name)
        }
      } finally {
        await reserved.unsafe('SELECT pg_advisory_unlock(871234)')
        await reserved.release()
        await lock.close()
      }
    },
    30_000,
  )
}
