import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureManagerWorkspace } from './manager-workspace'

const collection = vi.hoisted(() => ({ findOne: vi.fn(), updateOne: vi.fn() }))
vi.mock('./collections', () => ({ workspacesCollection: () => collection }))
const existing = { _id: 'ws-original', id: 'ws-original', managerId: 'manager-1', nombre: 'Mi entorno', estado: 'activo' }

beforeEach(() => vi.resetAllMocks())

describe('Manager workspace provisioning', () => {
  it('preserves an existing workspace without writing or replacing its identity', async () => {
    collection.findOne.mockResolvedValue(existing)
    expect(await ensureManagerWorkspace({ id: 'manager-1' })).toEqual(existing)
    expect(collection.updateOne).not.toHaveBeenCalled()
  })
  it('creates missing workspaces using an atomic manager-scoped upsert', async () => {
    collection.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing)
    expect(await ensureManagerWorkspace({ id: 'manager-1', name: 'Ana' }, { actorId: 'admin-1' })).toEqual(existing)
    expect(collection.updateOne).toHaveBeenCalledWith({ managerId: 'manager-1' }, {
      $setOnInsert: expect.objectContaining({ managerId: 'manager-1', nombre: 'Entorno de Ana', creadoPor: 'admin-1', estado: 'activo' }),
    }, { upsert: true })
  })
  it('retains the winner when concurrent requests hit the unique manager index', async () => {
    collection.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing)
    collection.updateOne.mockRejectedValue({ code: 11000 })
    expect(await ensureManagerWorkspace({ id: 'manager-1' })).toEqual(existing)
  })
  it('reactivates the same workspace only on explicit repair', async () => {
    collection.findOne.mockResolvedValue({ ...existing, estado: 'suspendido' })
    expect(await ensureManagerWorkspace({ id: 'manager-1' })).toMatchObject({ estado: 'suspendido' })
    expect(collection.updateOne).not.toHaveBeenCalled()
    expect(await ensureManagerWorkspace({ id: 'manager-1' }, { reactivate: true })).toMatchObject({ id: 'ws-original', estado: 'activo' })
    expect(collection.updateOne).toHaveBeenCalledWith({ _id: 'ws-original' }, { $set: { estado: 'activo' } })
  })
  it('does not hide database failures', async () => {
    collection.findOne.mockResolvedValueOnce(null)
    collection.updateOne.mockRejectedValue(new Error('database offline'))
    await expect(ensureManagerWorkspace({ id: 'manager-1' })).rejects.toThrow('database offline')
  })
})
