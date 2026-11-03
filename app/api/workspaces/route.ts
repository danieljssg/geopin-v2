import { headers } from 'next/headers'
import { apiRoute, jsonOk } from '@/lib/server/http'
import { membershipsCollection, workspacesCollection } from '@/lib/server/collections'
import { requireSessionUser } from '@/lib/server/session'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  return apiRoute(async () => {
    const user = await requireSessionUser(await headers())
    if (user.role === 'admin') return jsonOk({ workspaces: await workspacesCollection().find({}).sort({ creadoEn: -1 }).toArray() })
    if (user.role === 'manager') return jsonOk({ workspaces: await workspacesCollection().find({ managerId: user.id }).toArray() })
    const memberships = await membershipsCollection().find({ userId: user.id }).toArray()
    const ids = [...new Set(memberships.map((membership) => membership.workspaceId))]
    return jsonOk({ workspaces: ids.length ? await workspacesCollection().find({ id: { $in: ids }, estado: 'activo' }).toArray() : [] })
  })
}
