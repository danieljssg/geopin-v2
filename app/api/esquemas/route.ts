import { headers } from 'next/headers'
import { apiRoute, jsonError, jsonOk } from '@/lib/server/http'
import { requireSessionUser } from '@/lib/server/session'
import { getModuleSchemas } from '@/lib/server/repositories/esquemas'
import { workspaceFieldsCollection } from '@/lib/server/collections'
import { accessibleSurvey } from '@/lib/server/survey-access'

export const dynamic = 'force-dynamic'

/**
 * Listado de esquemas publicados.
 *
 * Lo consume la app de campo para renderizar el formulario, y el
 * administrador de esquemas para partir del estado actual. Cualquier usuario
 * con sesión puede leerlos: sin el esquema, la app no puede capturar nada.
 */
export async function GET(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requireSessionUser(requestHeaders)

    const esquemas = await getModuleSchemas()
    const url = new URL(request.url)
    const surveyId = url.searchParams.get('levantamientoId')?.trim()
    if (surveyId) {
      const survey = await accessibleSurvey(user, surveyId)
      if (!survey) return jsonError('No tienes acceso a este levantamiento.', 403)
      if (survey.workspaceId) {
        const fields = await workspaceFieldsCollection().find({ workspaceId: survey.workspaceId }).sort({ creadoEn: 1 }).toArray()
        const edificacion = esquemas.get('edificacion')
        if (edificacion && fields.length) esquemas.set('edificacion', { ...edificacion, campos: [...edificacion.campos, ...fields.map((item) => item.field)] })
      }
    }

    return jsonOk({
      esquemas: [...esquemas.values()].sort((a, b) => a.moduleId.localeCompare(b.moduleId)),
    })
  })
}
