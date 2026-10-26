import { headers } from 'next/headers'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { requirePermission } from '@/lib/server/session'
import { findLevantamiento, updateLevantamiento } from '@/lib/server/repositories/levantamientos'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Edición de una campaña existente.
 *
 * El cuerpo es parcial: el panel manda los tres campos, pero la ruta acepta
 * cualquiera de ellos. La validación replica la del POST (`nombre` y `ciudad`
 * no vacíos, `totalEsperado` entero no negativo) para que crear y editar no
 * acepten cosas distintas. `creadoPor` no se lee del cuerpo: la autoría la
 * fija el servidor al crear.
 */
export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    await requirePermission(requestHeaders, 'levantamiento:gestionar')

    const { id } = await context.params
    const existente = await findLevantamiento(id)
    if (!existente) return jsonError('El levantamiento no existe.', 404)

    const raw = await readJsonBody(request)
    if (typeof raw !== 'object' || raw === null) {
      return jsonError('El cuerpo de la petición debe ser un objeto.', 400)
    }

    const cuerpo = raw as Record<string, unknown>
    const sinCampos =
      cuerpo.nombre === undefined &&
      cuerpo.ciudad === undefined &&
      cuerpo.totalEsperado === undefined
    if (sinCampos) return jsonError('La actualización no contiene ningún campo.', 400)

    const cambios: { nombre?: string; ciudad?: string; totalEsperado?: number } = {}

    if (cuerpo.nombre !== undefined) {
      const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : ''
      if (nombre === '') return jsonError('Falta "nombre".', 400)
      cambios.nombre = nombre
    }

    if (cuerpo.ciudad !== undefined) {
      const ciudad = typeof cuerpo.ciudad === 'string' ? cuerpo.ciudad.trim() : ''
      if (ciudad === '') return jsonError('Falta "ciudad".', 400)
      cambios.ciudad = ciudad
    }

    if (cuerpo.totalEsperado !== undefined) {
      // Solo un número JSON real: `Number()` coerciona null→0, true→1 o
      // []→0 y terminaría sobreescribiendo el total con basura.
      const totalEsperado = cuerpo.totalEsperado
      if (
        typeof totalEsperado !== 'number' ||
        !Number.isInteger(totalEsperado) ||
        totalEsperado < 0
      ) {
        return jsonError('"totalEsperado" debe ser un entero no negativo.', 400)
      }
      cambios.totalEsperado = totalEsperado
    }

    const levantamiento = await updateLevantamiento(id, cambios)
    // La campaña pudo borrarse entre la lectura y la escritura.
    if (!levantamiento) return jsonError('El levantamiento no existe.', 404)

    return jsonOk({ levantamiento })
  })
}
