import { headers } from 'next/headers'
import { parseSyncRequest, type SyncItemResult, type SyncResponse } from '@/lib/api/contracts'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { requireSessionUser } from '@/lib/server/session'
import {
  DuplicateCodigoError,
  validateModuleInputs,
  writeParcela,
} from '@/lib/server/services/parcelas'

export const dynamic = 'force-dynamic'

/**
 * Sincronización por lotes.
 *
 * Es el endpoint que consume la cola offline del cliente de campo. Cada
 * parcela se procesa por separado: un error en una no detiene al resto de la
 * tanda, y la respuesta dice qué pasó con cada una.
 *
 * La idempotencia viene del id que genera el cliente y de las reglas de
 * `lib/domain/sync.ts`: reenviar la misma parcela no la duplica y un
 * reintento de una escritura ya aplicada se reporta como `ignorado`, no como
 * conflicto.
 */
export async function POST(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requireSessionUser(requestHeaders)

    const raw = await readJsonBody(request)
    const parsed = parseSyncRequest(raw)
    if (!parsed.ok) return jsonError(parsed.error, 400)

    const resultados: SyncItemResult[] = []

    for (const parcela of parsed.value.parcels) {
      const failures = await validateModuleInputs(parcela.modulos ?? [])

      if (failures.length > 0) {
        resultados.push({
          id: parcela.id,
          estado: 'error',
          error: failures
            .map((failure) => `${failure.moduleId}: ${failure.errores.map((e) => e.message).join(' ')}`)
            .join(' | '),
        })
        continue
      }

      try {
        const result = await writeParcela(parcela, { id: user.id, nombre: user.name })
        resultados.push({
          id: result.id,
          estado: result.estado,
          resultados: result.resultados,
          conflictos: result.conflictos,
        })
      } catch (error) {
        if (error instanceof DuplicateCodigoError) {
          resultados.push({ id: parcela.id, estado: 'error', error: error.message })
          continue
        }
        resultados.push({
          id: parcela.id,
          estado: 'error',
          error: error instanceof Error ? error.message : 'Error desconocido.',
        })
      }
    }

    const body: SyncResponse = { resultados }
    return jsonOk(body)
  })
}
