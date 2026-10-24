import { headers } from 'next/headers'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { requirePermission, requireSessionUser } from '@/lib/server/session'
import { createLevantamiento, listLevantamientos } from '@/lib/server/repositories/levantamientos'

export const dynamic = 'force-dynamic'

/** Listado de campañas. Lo necesita el selector del dashboard. */
export async function GET(): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    await requireSessionUser(requestHeaders)

    const levantamientos = await listLevantamientos()
    return jsonOk({ levantamientos })
  })
}

/** Alta de una campaña. Es gestión administrativa. */
export async function POST(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requirePermission(requestHeaders, 'levantamiento:gestionar')

    const raw = await readJsonBody(request)
    if (typeof raw !== 'object' || raw === null) {
      return jsonError('El cuerpo de la petición debe ser un objeto.', 400)
    }

    const cuerpo = raw as Record<string, unknown>
    const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : ''
    const ciudad = typeof cuerpo.ciudad === 'string' ? cuerpo.ciudad.trim() : ''
    const totalEsperado = Number(cuerpo.totalEsperado)

    if (nombre === '') return jsonError('Falta "nombre".', 400)
    if (ciudad === '') return jsonError('Falta "ciudad".', 400)
    if (!Number.isInteger(totalEsperado) || totalEsperado < 0) {
      return jsonError('"totalEsperado" debe ser un entero no negativo.', 400)
    }

    const ahora = new Date().toISOString()
    const levantamiento = await createLevantamiento({
      id: crypto.randomUUID(),
      nombre,
      ciudad,
      totalEsperado,
      creadoEn: ahora,
      creadoPor: user.id,
    })

    return jsonOk({ levantamiento }, 201)
  })
}
