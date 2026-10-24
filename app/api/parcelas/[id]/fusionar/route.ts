import { headers } from 'next/headers'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { requirePermission } from '@/lib/server/session'
import { fusionarParcela } from '@/lib/server/services/importacion'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * Resuelve un conflicto de una parcela.
 *
 * El administrador eligió el valor final de cada campo en disputa y se
 * aplican de una vez. Lo que no aparece en `cambios` se conserva.
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requirePermission(requestHeaders, 'conflictos:resolver')

    const { id } = await context.params

    const raw = await readJsonBody(request)
    if (typeof raw !== 'object' || raw === null) {
      return jsonError('El cuerpo de la petición debe ser un objeto.', 400)
    }

    const cambios = (raw as Record<string, unknown>).cambios
    if (typeof cambios !== 'object' || cambios === null) {
      return jsonError('Falta "cambios".', 400)
    }

    const fusionada = await fusionarParcela(id, cambios as Record<string, unknown>, { id: user.id, nombre: user.name })
    if (!fusionada) return jsonError('La parcela no existe.', 404)

    return jsonOk({ parcela: fusionada })
  })
}
