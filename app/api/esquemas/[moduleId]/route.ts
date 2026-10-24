import { headers } from 'next/headers'
import { parseSchemaSave } from '@/lib/api/contracts'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { requirePermission } from '@/lib/server/session'
import { getModuleSchema, saveModuleSchema } from '@/lib/server/repositories/esquemas'
import { draftToSchema, validateSchemaFields } from '@/lib/domain/schema-builder'
import { MODULOS } from '@/lib/domain/schema-builder'
import type { ModuloId } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ moduleId: string }>
}

/**
 * Guarda los campos de un módulo.
 *
 * El guardado es atómico sobre la lista completa de campos: el
 * administrador edita el módulo entero y lo publica de una vez. Así no
 * quedan estados intermedios donde un campo existe pero su vecino no.
 */
export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requirePermission(requestHeaders, 'esquema:editar')

    const { moduleId } = await context.params
    const modulo = MODULOS.find((m) => m.id === moduleId)
    if (!modulo) {
      return jsonError(`El módulo "${moduleId}" no existe.`, 404)
    }

    const raw = await readJsonBody(request)
    const parsed = parseSchemaSave(raw)
    if (!parsed.ok) return jsonError(parsed.error, 400)

    const errores = validateSchemaFields(parsed.value.campos)
    if (errores.length > 0) {
      return jsonError(errores.map((error) => error.message).join(' | '), 422)
    }

    const actual = await getModuleSchema(moduleId)
    const esquema = draftToSchema({
      moduleId,
      modulo: modulo.id as ModuloId,
      campos: parsed.value.campos,
      versionActual: actual?.version ?? 0,
      actor: user.id,
      now: new Date().toISOString(),
    })

    await saveModuleSchema(esquema)

    return jsonOk({ esquema })
  })
}
