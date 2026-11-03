import { createHash } from 'node:crypto'
import { headers } from 'next/headers'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { invitationsCollection, levantamientosCollection, membershipsCollection, workspacesCollection } from '@/lib/server/collections'
import { requireSessionUser } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const user = await requireSessionUser(await headers())
    const body = await readJsonBody(request)
    if (typeof body !== 'object' || body === null) return jsonError('Código o enlace inválido.', 400)
    const raw = body as Record<string, unknown>
    const value = typeof raw.invite === 'string' ? raw.invite.trim() : typeof raw.code === 'string' ? raw.code.trim().toUpperCase() : ''
    if (value.length < 8 || value.length > 128) return jsonError('Código o enlace inválido.', 400)
    const digest = createHash('sha256').update(value).digest('hex')
    const invitation = await invitationsCollection().findOne({ digest, revocado: false, expiraEn: { $gt: new Date().toISOString() } })
    if (!invitation) return jsonError('La invitación no existe, venció o fue revocada.', 404)
    const workspace = await workspacesCollection().findOne({ _id: invitation.workspaceId, estado: 'activo' })
    if (!workspace) return jsonError('El entorno invitado ya no está disponible.', 410)
    if (invitation.targetType === 'survey') {
      const survey = await levantamientosCollection().findOne({ _id: invitation.targetId, workspaceId: workspace.id })
      if (!survey) return jsonError('El levantamiento invitado ya no está disponible.', 410)
    }
    const id = `${invitation.targetType}:${invitation.targetId}:${user.id}`
    await membershipsCollection().replaceOne({ _id: id }, { id, workspaceId: workspace.id, userId: user.id, ...(invitation.targetType === 'survey' ? { surveyId: invitation.targetId } : {}), creadoEn: new Date().toISOString(), invitacionId: invitation._id }, { upsert: true })
    return jsonOk({ joined: true, workspaceId: workspace.id, ...(invitation.targetType === 'survey' ? { surveyId: invitation.targetId } : {}) })
  })
}
