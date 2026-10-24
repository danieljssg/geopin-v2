import { headers } from 'next/headers'
import { apiRoute, jsonOk } from '@/lib/server/http'
import { requireSessionUser } from '@/lib/server/session'
import { parsearCapasSuperpuestas, todasLasCapas, validarCapas } from '@/lib/map/capas'

export const dynamic = 'force-dynamic'

/**
 * Configuración de las capas del mapa.
 *
 * Las superposiciones se configuran con `CAPAS_SUPERPUESTAS`, una variable
 * del servidor con un JSON. Al ser del servidor y no del cliente, agregar una
 * ortofoto municipal no obliga a recompilar la app.
 */
export async function GET(): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    await requireSessionUser(requestHeaders)

    const superpuestas = parsearCapasSuperpuestas(process.env.CAPAS_SUPERPUESTAS)
    const capas = todasLasCapas(process.env.NEXT_PUBLIC_TILE_BASE_URL ?? '', superpuestas.capas)

    const avisos: string[] = []
    if (superpuestas.error) avisos.push(superpuestas.error)
    avisos.push(...validarCapas(capas))

    return jsonOk({ capas, avisos })
  })
}
