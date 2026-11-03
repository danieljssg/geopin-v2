import { workspacesCollection } from './collections'

/** Preserve workspace identity and all existing surveys when repairing access. */
export async function ensureManagerWorkspace(
  manager: { id: string; name?: string | null },
  options: { actorId?: string; reactivate?: boolean } = {},
) {
  const collection = workspacesCollection()
  const existing = await collection.findOne({ managerId: manager.id })
  if (existing) {
    if (options.reactivate && existing.estado !== 'activo') {
      await collection.updateOne({ _id: existing._id }, { $set: { estado: 'activo' } })
      return { ...existing, estado: 'activo' as const }
    }
    return existing
  }
  const id = crypto.randomUUID()
  try {
    await collection.updateOne({ managerId: manager.id }, {
      $setOnInsert: {
        _id: id, id, managerId: manager.id,
        nombre: `Entorno de ${manager.name?.trim() || manager.id}`.slice(0, 120),
        creadoEn: new Date().toISOString(), creadoPor: options.actorId ?? manager.id, estado: 'activo',
      },
    }, { upsert: true })
  } catch (error) {
    // The unique managerId index resolves concurrent provisioning attempts.
    if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 11000) throw error
  }
  const workspace = await collection.findOne({ managerId: manager.id })
  if (!workspace) throw new Error('No se pudo provisionar el entorno Manager.')
  return workspace
}
