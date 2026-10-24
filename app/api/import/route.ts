import { headers } from 'next/headers'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { requirePermission } from '@/lib/server/session'
import {
  analizarImportacion,
  aplicarImportacion,
} from '@/lib/server/services/importacion'

export const dynamic = 'force-dynamic'

/**
 * Importación de archivos de campo.
 *
 * `aplicar: false` es una previsualización: analiza el archivo y dice qué
 * passaría, sin escribir nada. `aplicar: true` crea las parcelas nuevas; las
 * que ya existen no se sobrescriben, sus diferencias quedan como conflictos
 * para resolver a mano.
 */
export async function POST(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requirePermission(requestHeaders, 'importar:ejecutar')

    const raw = await readJsonBody(request)
    if (typeof raw !== 'object' || raw === null) {
      return jsonError('El cuerpo de la petición debe ser un objeto.', 400)
    }

    const cuerpo = raw as Record<string, unknown>
    const formato = cuerpo.formato === 'csv' ? 'csv' : cuerpo.formato === 'xlsx' ? 'xlsx' : null

    if (!formato) {
      return jsonError('"formato" debe ser "csv" o "xlsx".', 400)
    }

    const contenido = typeof cuerpo.contenido === 'string' ? cuerpo.contenido : ''
    if (contenido === '') {
      return jsonError('Falta el contenido del archivo.', 400)
    }

    const aplicar = cuerpo.aplicar === true

    const resultado = aplicar
      ? await aplicarImportacion(contenido, formato, { id: user.id, nombre: user.name })
      : await analizarImportacion(contenido, formato)

    return jsonOk(resultado)
  })
}
