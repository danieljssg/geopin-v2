import { headers } from 'next/headers'
import {
  parseListQuery,
  parseParcelaCreate,
  type ParcelasListResponse,
} from '@/lib/api/contracts'
import { isAdmin } from '@/lib/auth/roles'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { requirePermission, requireSessionUser } from '@/lib/server/session'
import { countParcelas, listParcelas } from '@/lib/server/repositories/parcelas'
import {
  DuplicateCodigoError,
  validateModuleInputs,
  writeParcela,
} from '@/lib/server/services/parcelas'

export const dynamic = 'force-dynamic'

/**
 * Listado y alta de parcelas.
 *
 * `POST` es idempotente por el id que genera el cliente: si la parcela ya
 * existe, la escritura se reaplica con las reglas de concurrencia por
 * módulo en lugar de duplicar el documento.
 */
export async function GET(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requireSessionUser(requestHeaders)

    const url = new URL(request.url)
    const query = parseListQuery(url)

    /**
     * Regla de visibilidad: un encuestador solo ve sus propios registros y el
     * admin ve todo. `mias=1` es el atajo de "Mis registros" y manda sobre
     * cualquier `creadoPor` de la URL; fuera de ese atajo, el filtro por
     * dueño solo lo aplica un admin.
     */
    const mias = url.searchParams.get('mias') === '1'
    const creadoPor = mias || !isAdmin(user.role) ? user.id : query.creadoPor

    const filtro = { ...query, creadoPor }
    const [parcelas, total] = await Promise.all([
      listParcelas(filtro),
      countParcelas(filtro),
    ])

    const body: ParcelasListResponse = {
      parcelas,
      total,
      limite: query.limite,
      skip: query.skip,
    }
    return jsonOk(body)
  })
}

export async function POST(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requirePermission(requestHeaders, 'parcela:crear')

    const raw = await readJsonBody(request)
    const parsed = parseParcelaCreate(raw)
    if (!parsed.ok) return jsonError(parsed.error, 400)

    const failures = await validateModuleInputs(parsed.value.modulos ?? [])
    if (failures.length > 0) {
      return jsonError(
        failures
          .map((failure) => `${failure.moduleId}: ${failure.errores.map((e) => e.message).join(' ')}`)
          .join(' | '),
        422,
      )
    }

    try {
      const result = await writeParcela(parsed.value, { id: user.id, nombre: user.name })
      return jsonOk(result, result.estado === 'creado' ? 201 : 200)
    } catch (error) {
      if (error instanceof DuplicateCodigoError) return jsonError(error.message, 409)
      throw error
    }
  })
}
