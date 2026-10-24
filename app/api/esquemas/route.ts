import { headers } from 'next/headers'
import { apiRoute, jsonOk } from '@/lib/server/http'
import { requireSessionUser } from '@/lib/server/session'
import { getModuleSchemas } from '@/lib/server/repositories/esquemas'

export const dynamic = 'force-dynamic'

/**
 * Listado de esquemas publicados.
 *
 * Lo consume la app de campo para renderizar el formulario, y el
 * administrador de esquemas para partir del estado actual. Cualquier usuario
 * con sesión puede leerlos: sin el esquema, la app no puede capturar nada.
 */
export async function GET(): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    await requireSessionUser(requestHeaders)

    const esquemas = await getModuleSchemas()

    return jsonOk({
      esquemas: [...esquemas.values()].sort((a, b) => a.moduleId.localeCompare(b.moduleId)),
    })
  })
}
