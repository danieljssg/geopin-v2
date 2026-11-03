import { ObjectId } from 'mongodb'
import { headers } from 'next/headers'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { requirePermission } from '@/lib/server/session'
import { usuariosCollection } from '@/lib/server/collections'
import { ensureManagerWorkspace } from '@/lib/server/manager-workspace'

export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const actor = await requirePermission(await headers(), 'usuarios:gestionar')
    const body = await readJsonBody(request)
    if (typeof body !== 'object' || body === null || !('userId' in body) || typeof body.userId !== 'string' || !body.userId.trim()) return jsonError('Indica el usuario Manager.', 400)
    const id = body.userId
    const user = await usuariosCollection().findOne({ _id: ObjectId.isValid(id) ? new ObjectId(id) : id })
    if (!user) return jsonError('El usuario no existe.', 404)
    if (user.role !== 'manager') return jsonError('El usuario debe tener el rol Manager.', 409)
    const workspace = await ensureManagerWorkspace({ id, name: user.name }, { actorId: actor.id, reactivate: true })
    return jsonOk({ workspace, message: 'Entorno Manager activo y asociado. Se conservaron sus datos existentes.' })
  })
}
