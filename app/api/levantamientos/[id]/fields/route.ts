import { headers } from 'next/headers'
import { parseSchemaSave } from '@/lib/api/contracts'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { workspaceFieldsCollection, workspacesCollection } from '@/lib/server/collections'
import { getModuleSchema } from '@/lib/server/repositories/esquemas'
import { requireSessionUser } from '@/lib/server/session'
import { accessibleSurvey } from '@/lib/server/survey-access'
import { validateSchemaFields } from '@/lib/domain/schema-builder'

export const dynamic = 'force-dynamic'
interface RouteContext { params: Promise<{ id: string }> }

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return apiRoute(async () => {
    const user = await requireSessionUser(await headers())
    const { id } = await context.params
    const survey = await accessibleSurvey(user, id)
    if (!survey) return jsonError('No tienes acceso a este levantamiento.', 403)
    if (!survey.workspaceId) return jsonError('Los campos personalizados requieren un entorno Manager.', 409)
    if (user.role !== 'admin') {
      const workspace = await workspacesCollection().findOne({ id: survey.workspaceId, managerId: user.id, estado: 'activo' })
      if (!workspace) return jsonError('Solo el Manager del entorno puede agregar campos.', 403)
    }
    const raw = await readJsonBody(request)
    if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as { campos?: unknown }).campos)) return jsonError('Falta la lista de campos.', 400)
    const input = raw as { campos: Record<string, unknown>[] }
    if (input.campos.some((item) => typeof item !== 'object' || item === null || Array.isArray(item))) return jsonError('Cada campo debe ser un objeto.', 400)
    const campos = input.campos.map((item) => ({ ...item, key: `campo_${id.replace(/[^a-z0-9]/g, '').slice(0, 24)}_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`, label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : `Campo de ${survey.nombre}`.slice(0, 120) }))
    const parsed = parseSchemaSave({ campos })
    if (!parsed.ok) return jsonError(parsed.error, 400)
    if (parsed.value.campos.length !== 1) return jsonError('Agrega un solo campo por solicitud.', 400)
    const field = parsed.value.campos[0]
    const base = await getModuleSchema('edificacion')
    if (base?.campos.some((item) => item.key === field.key)) return jsonError('Ese identificador ya pertenece al formulario base.', 409)
    const collection = workspaceFieldsCollection()
    const key = `${survey.workspaceId}:${field.key}`
    if (await collection.findOne({ _id: key })) return jsonError('Ese campo ya existe en el entorno.', 409)
    const errors = validateSchemaFields([field])
    if (errors.length) return jsonError(errors.map((item) => item.message).join(' '), 422)
    await collection.insertOne({ _id: key, workspaceId: survey.workspaceId, field, creadoPor: user.id, creadoEn: new Date().toISOString() })
    return jsonOk({ field }, 201)
  })
}
