import { join } from 'node:path'
import {
  baixarSchema,
  cancelarManutencaoSchema,
  categoriaSchema,
  concluirManutencaoSchema,
  createEquipamentoSchema,
  excluirSchema,
  abrirManutencaoSchema,
  setorSchema,
  transferirSchema,
  updateEquipamentoSchema,
} from '@/lib/schemas'
import { importDatabase, readDatabaseFile } from '@/db/backup'
import { deleteCategoria, listCategorias, saveCategoria } from '@/db/categorias'
import { dashboard } from '@/db/dashboard'
import {
  baixarEquipamento,
  createEquipamento,
  deleteEquipamento,
  getEquipamento,
  listEquipamentos,
  nextTombamento,
  reativarEquipamento,
  transferirEquipamento,
  updateEquipamento,
} from '@/db/equipamentos'
import { AppError } from '@/db/errors'
import {
  abrirManutencao,
  cancelarManutencao,
  concluirManutencao,
  listManutencoes,
} from '@/db/manutencoes'
import { deleteSetor, listSetores, saveSetor } from '@/db/setores'
import { getDb } from '@/db/sqlite'
import { todayLocal } from '@/lib/dates'
import type { StatusEquipamento } from '@/lib/types'

const PORT = Number(process.env.PORT ?? 8787)
const DIST = join(process.cwd(), 'dist')

getDb()

function json(data: unknown, status = 200) {
  return Response.json(data, { status })
}

function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return json({ erro: err.message }, 400)
  }
  console.error(err)
  return json({ erro: 'Não foi possível concluir a operação.' }, 500)
}

async function parseJson<T>(req: Request): Promise<T> {
  return (await req.json()) as T
}

function boolParam(v: string | null, defaultValue = false) {
  if (v == null) return defaultValue
  return v === '1' || v === 'true'
}

async function handleApi(req: Request, url: URL): Promise<Response> {
  const path = url.pathname
  const method = req.method

  try {
    if (path === '/api/painel' && method === 'GET') {
      return json(dashboard())
    }

    if (path === '/api/setores' && method === 'GET') {
      return json(listSetores(boolParam(url.searchParams.get('incluirInativos'))))
    }
    if (path === '/api/setores' && method === 'POST') {
      const body = setorSchema.parse(await parseJson(req))
      return json(saveSetor(body), 201)
    }
    {
      const m = /^\/api\/setores\/(\d+)$/.exec(path)
      if (m && method === 'PATCH') {
        const body = setorSchema.parse(await parseJson(req))
        return json(saveSetor({ ...body, id: Number(m[1]) }))
      }
      if (m && method === 'DELETE') {
        deleteSetor(Number(m[1]))
        return json({ ok: true })
      }
    }

    if (path === '/api/categorias' && method === 'GET') {
      return json(listCategorias(boolParam(url.searchParams.get('incluirInativos'))))
    }
    if (path === '/api/categorias' && method === 'POST') {
      const body = categoriaSchema.parse(await parseJson(req))
      return json(saveCategoria(body), 201)
    }
    {
      const m = /^\/api\/categorias\/(\d+)$/.exec(path)
      if (m && method === 'PATCH') {
        const body = categoriaSchema.parse(await parseJson(req))
        return json(saveCategoria({ ...body, id: Number(m[1]) }))
      }
      if (m && method === 'DELETE') {
        deleteCategoria(Number(m[1]))
        return json({ ok: true })
      }
    }

    if (path === '/api/equipamentos/proximo-tombamento' && method === 'GET') {
      return json({ tombamento: nextTombamento() })
    }

    if (path === '/api/equipamentos' && method === 'GET') {
      const status = url.searchParams.get('status') as StatusEquipamento | null
      return json(
        listEquipamentos({
          q: url.searchParams.get('q') ?? undefined,
          categoriaId: url.searchParams.get('categoriaId')
            ? Number(url.searchParams.get('categoriaId'))
            : undefined,
          setorId: url.searchParams.get('setorId')
            ? Number(url.searchParams.get('setorId'))
            : undefined,
          status: status || undefined,
          sort: (url.searchParams.get('sort') as 'tombamento' | 'nome' | 'status') || 'tombamento',
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

    if (path === '/api/equipamentos' && method === 'POST') {
      const body = createEquipamentoSchema.parse(await parseJson(req))
      return json(createEquipamento(body), 201)
    }

    {
      const m = /^\/api\/equipamentos\/(\d+)$/.exec(path)
      if (m && method === 'GET') {
        return json(getEquipamento(Number(m[1])))
      }
      if (m && method === 'PATCH') {
        const body = updateEquipamentoSchema.parse(await parseJson(req))
        return json(updateEquipamento(Number(m[1]), body))
      }
    }

    {
      const m = /^\/api\/equipamentos\/(\d+)\/transferir$/.exec(path)
      if (m && method === 'POST') {
        const body = transferirSchema.parse(await parseJson(req))
        return json(transferirEquipamento(Number(m[1]), body))
      }
    }
    {
      const m = /^\/api\/equipamentos\/(\d+)\/baixar$/.exec(path)
      if (m && method === 'POST') {
        const body = baixarSchema.parse(await parseJson(req))
        return json(baixarEquipamento(Number(m[1]), body))
      }
    }
    {
      const m = /^\/api\/equipamentos\/(\d+)\/reativar$/.exec(path)
      if (m && method === 'POST') {
        return json(reativarEquipamento(Number(m[1])))
      }
    }
    {
      const m = /^\/api\/equipamentos\/(\d+)\/excluir$/.exec(path)
      if (m && method === 'POST') {
        const body = excluirSchema.parse(await parseJson(req))
        deleteEquipamento(Number(m[1]), body.tombamentoConfirmacao)
        return json({ ok: true })
      }
    }

    if (path === '/api/manutencoes' && method === 'GET') {
      return json(
        listManutencoes({
          situacao: (url.searchParams.get('situacao') as never) || undefined,
          tipo: (url.searchParams.get('tipo') as never) || undefined,
          equipamentoId: url.searchParams.get('equipamentoId')
            ? Number(url.searchParams.get('equipamentoId'))
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

    if (path === '/api/manutencoes' && method === 'POST') {
      const body = abrirManutencaoSchema.parse(await parseJson(req))
      return json(abrirManutencao(body), 201)
    }
    {
      const m = /^\/api\/manutencoes\/(\d+)\/concluir$/.exec(path)
      if (m && method === 'POST') {
        const body = concluirManutencaoSchema.parse(await parseJson(req))
        return json(concluirManutencao(Number(m[1]), body))
      }
    }
    {
      const m = /^\/api\/manutencoes\/(\d+)\/cancelar$/.exec(path)
      if (m && method === 'POST') {
        const body = cancelarManutencaoSchema.parse(await parseJson(req))
        return json(cancelarManutencao(Number(m[1]), body))
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

    return json({ erro: 'Rota não encontrada.' }, 404)
  } catch (err) {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
      return json({ erro: 'Dados inválidos.' }, 400)
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
    if (url.pathname.startsWith('/api/')) {
      return handleApi(req, url)
    }

    const staticResponse = await serveStatic(url.pathname)
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
