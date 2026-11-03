import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { headers } from 'next/headers'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { invitationsCollection, levantamientosCollection, workspacesCollection } from '@/lib/server/collections'
import { requireSessionUser } from '@/lib/server/session'

export const dynamic = 'force-dynamic'
const digest = (value: string) => createHash('sha256').update(value).digest('hex')

async function managerWorkspace(userId: string) {
  return workspacesCollection().findOne({ managerId: userId, estado: 'activo' })
}

export async function GET(): Promise<Response> {
  return apiRoute(async () => {
    const user = await requireSessionUser(await headers())
    const workspace = await managerWorkspace(user.id)
    if (!workspace && user.role !== 'admin') return jsonError('No tienes un entorno Manager activo.', 403)
    const invitations = await invitationsCollection().find({ workspaceId: workspace?.id }).sort({ creadoEn: -1 }).toArray()
    return jsonOk({ invitations: invitations.map(({ digest: _digest, ...invitation }) => invitation) })
  })
}

export async function POST(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const user = await requireSessionUser(await headers())
    const workspace = await managerWorkspace(user.id)
    if (!workspace) return jsonError('No tienes un entorno Manager activo.', 403)
    const body = await readJsonBody(request)
    if (typeof body !== 'object' || body === null) return jsonError('Solicitud inválida.', 400)
    const input = body as Record<string, unknown>
    const targetType = input.targetType === 'survey' ? 'survey' : input.targetType === 'workspace' ? 'workspace' : null
    const targetId = typeof input.targetId === 'string' ? input.targetId.trim() : workspace.id
    if (!targetType || (targetType === 'workspace' && targetId !== workspace.id)) return jsonError('Destino de invitación inválido.', 400)
    if (targetType === 'survey') {
      const survey = await levantamientosCollection().findOne({ _id: targetId, workspaceId: workspace.id })
      if (!survey) return jsonError('El levantamiento no pertenece a tu entorno.', 404)
    }
    const secret = randomBytes(24).toString('base64url')
    const code = randomBytes(6).toString('hex').toUpperCase()
    const id = randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    await invitationsCollection().insertOne({ _id: id, digest: digest(secret), targetType, targetId, workspaceId: workspace.id, creadoPor: user.id, creadoEn: now.toISOString(), expiraEn: expiresAt.toISOString(), revocado: false })
    await invitationsCollection().insertOne({ _id: `code:${id}`, digest: digest(code), targetType, targetId, workspaceId: workspace.id, creadoPor: user.id, creadoEn: now.toISOString(), expiraEn: expiresAt.toISOString(), revocado: false })
    const origin = new URL(request.url).origin
    return jsonOk({ id, code, link: `${origin}/join?invite=${encodeURIComponent(secret)}`, expiresAt: expiresAt.toISOString() }, 201)
  })
}
