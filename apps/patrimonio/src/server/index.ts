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
import { getDb } from '@/db/sqlite'
import { todayLocal } from '@/lib/dates'
import type { EquipmentStatus } from '@/lib/types'

const PORT = Number(process.env.PORT ?? 8787)
const DIST = join(process.cwd(), 'dist')

getDb()

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

async function handleApi(req: Request, url: URL): Promise<Response> {
  const path = url.pathname
  const method = req.method

  try {
    if (path === '/api/dashboard' && method === 'GET') {
      return json(dashboard())
    }

    if (path === '/api/sectors' && method === 'GET') {
      return json(listSectors(boolParam(url.searchParams.get('includeInactive'))))
    }
    if (path === '/api/sectors' && method === 'POST') {
      const body = sectorSchema.parse(await parseJson(req))
      return json(saveSector(body), 201)
    }
    {
      const match = /^\/api\/sectors\/(\d+)$/.exec(path)
      if (match && method === 'PATCH') {
        const body = sectorSchema.parse(await parseJson(req))
        return json(saveSector({ ...body, id: Number(match[1]) }))
      }
      if (match && method === 'DELETE') {
        deleteSector(Number(match[1]))
        return json({ ok: true })
      }
    }

    if (path === '/api/categories' && method === 'GET') {
      return json(listCategories(boolParam(url.searchParams.get('includeInactive'))))
    }
    if (path === '/api/categories' && method === 'POST') {
      const body = categorySchema.parse(await parseJson(req))
      return json(saveCategory(body), 201)
    }
    {
      const match = /^\/api\/categories\/(\d+)$/.exec(path)
      if (match && method === 'PATCH') {
        const body = categorySchema.parse(await parseJson(req))
        return json(saveCategory({ ...body, id: Number(match[1]) }))
      }
      if (match && method === 'DELETE') {
        deleteCategory(Number(match[1]))
        return json({ ok: true })
      }
    }

    if (path === '/api/equipment/next-asset-tag' && method === 'GET') {
      return json({ assetTag: nextAssetTag() })
    }

    if (path === '/api/equipment' && method === 'GET') {
      const status = url.searchParams.get('status') as EquipmentStatus | null
      return json(
        listEquipment({
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
      return json(createEquipment(body), 201)
    }

    {
      const match = /^\/api\/equipment\/(\d+)$/.exec(path)
      if (match && method === 'GET') {
        return json(getEquipment(Number(match[1])))
      }
      if (match && method === 'PATCH') {
        const body = updateEquipmentSchema.parse(await parseJson(req))
        return json(updateEquipment(Number(match[1]), body))
      }
    }

    {
      const match = /^\/api\/equipment\/(\d+)\/transfer$/.exec(path)
      if (match && method === 'POST') {
        const body = transferSchema.parse(await parseJson(req))
        return json(transferEquipment(Number(match[1]), body))
      }
    }
    {
      const match = /^\/api\/equipment\/(\d+)\/write-off$/.exec(path)
      if (match && method === 'POST') {
        const body = writeOffSchema.parse(await parseJson(req))
        return json(writeOffEquipment(Number(match[1]), body))
      }
    }
    {
      const match = /^\/api\/equipment\/(\d+)\/reactivate$/.exec(path)
      if (match && method === 'POST') {
        return json(reactivateEquipment(Number(match[1])))
      }
    }
    {
      const match = /^\/api\/equipment\/(\d+)\/in-use$/.exec(path)
      if (match && method === 'POST') {
        return json(markEquipmentInUse(Number(match[1])))
      }
    }
    {
      const match = /^\/api\/equipment\/(\d+)\/delete$/.exec(path)
      if (match && method === 'POST') {
        const body = deleteEquipmentSchema.parse(await parseJson(req))
        deleteEquipment(Number(match[1]), body.assetTagConfirmation)
        return json({ ok: true })
      }
    }

    if (path === '/api/maintenance' && method === 'GET') {
      return json(
        listMaintenance({
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
      return json(openMaintenance(body), 201)
    }
    {
      const match = /^\/api\/maintenance\/(\d+)\/complete$/.exec(path)
      if (match && method === 'POST') {
        const body = completeMaintenanceSchema.parse(await parseJson(req))
        return json(completeMaintenance(Number(match[1]), body))
      }
    }
    {
      const match = /^\/api\/maintenance\/(\d+)\/cancel$/.exec(path)
      if (match && method === 'POST') {
        const body = cancelMaintenanceSchema.parse(await parseJson(req))
        return json(cancelMaintenance(Number(match[1]), body))
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
