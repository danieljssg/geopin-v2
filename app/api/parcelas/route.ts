import { headers } from 'next/headers'
import {
  parseListQuery,
  parseParcelaCreate,
  type ParcelasListResponse,
} from '@/lib/api/contracts'
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
    await requireSessionUser(requestHeaders)

    const query = parseListQuery(new URL(request.url))
    const [parcelas, total] = await Promise.all([
      listParcelas(query),
      countParcelas(query),
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
