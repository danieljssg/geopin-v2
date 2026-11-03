import { ObjectId } from 'mongodb'
import { headers } from 'next/headers'
import { isAdmin } from '@/lib/auth/roles'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { managerRequestsCollection, usuariosCollection } from '@/lib/server/collections'
import { provisionManagerAccount } from '@/lib/server/manager-workspace'
import { requireSessionUser } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return apiRoute(async () => {
    const user = await requireSessionUser(await headers())
    return jsonOk({ solicitudes: await managerRequestsCollection().find(isAdmin(user.role) ? {} : { userId: user.id }).sort({ creadoEn: -1 }).toArray() })
  })
}

export async function POST(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const user = await requireSessionUser(await headers())
    if (user.role !== 'encuestador') return jsonError('Solo un encuestador puede solicitar el rol Manager.', 403)
    const body = await readJsonBody(request)
    if (typeof body !== 'object' || body === null) return jsonError('Solicitud inválida.', 400)
    const input = body as Record<string, unknown>
    const nombreWorkspace = typeof input.nombreWorkspace === 'string' ? input.nombreWorkspace.trim() : ''
    const proposito = typeof input.proposito === 'string' ? input.proposito.trim() : ''
    const participantesEsperados = input.participantesEsperados
    if (!nombreWorkspace || nombreWorkspace.length > 120 || !proposito || proposito.length > 3000 || typeof participantesEsperados !== 'number' || !Number.isInteger(participantesEsperados) || participantesEsperados < 0 || participantesEsperados > 10000) {
      return jsonError('Indica el nombre del entorno, su propósito y un número válido de participantes.', 400)
    }
    const collection = managerRequestsCollection()
    const existing = await collection.findOne({ userId: user.id, estado: 'pendiente' })
    if (existing) return jsonError('Ya tienes una solicitud pendiente.', 409)
    const id = crypto.randomUUID()
    await collection.insertOne({ _id: id, userId: user.id, nombreWorkspace, proposito, participantesEsperados, estado: 'pendiente', creadoEn: new Date().toISOString() })
    return jsonOk({ id, estado: 'pendiente' }, 201)
  })
}

export async function PATCH(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const actor = await requireSessionUser(await headers())
    if (!isAdmin(actor.role)) return jsonError('Solo el administrador puede resolver solicitudes.', 403)
    const body = await readJsonBody(request)
    if (typeof body !== 'object' || body === null) return jsonError('Solicitud inválida.', 400)
    const { id, decision } = body as Record<string, unknown>
    if (typeof id !== 'string' || !['aprobada', 'rechazada'].includes(String(decision))) return jsonError('Decisión inválida.', 400)
    const decisionValida = decision as 'aprobada' | 'rechazada'
    const requests = managerRequestsCollection()
    const solicitud = await requests.findOne({ _id: id, estado: 'pendiente' })
    if (!solicitud) return jsonError('La solicitud pendiente no existe.', 404)
    const now = new Date().toISOString()
    let workspaceId: string | undefined
    if (decisionValida === 'aprobada') {
      const userId = ObjectId.isValid(solicitud.userId) ? new ObjectId(solicitud.userId) : solicitud.userId
      const users = usuariosCollection()
      const updated = await users.updateOne({ _id: userId }, { $set: { role: 'manager' } })
      if (updated.matchedCount === 0) return jsonError('No se encontró la cuenta solicitante.', 404)
      const workspace = await provisionManagerAccount({ id: solicitud.userId }, { actorId: actor.id, reactivate: true })
      workspaceId = workspace.id
    }
    await requests.updateOne({ _id: id, estado: 'pendiente' }, { $set: { estado: decisionValida, revisadoEn: now, revisadoPor: actor.id, ...(workspaceId ? { workspaceId } : {}) } })
    return jsonOk({ estado: decisionValida, workspaceId })
  })
}
