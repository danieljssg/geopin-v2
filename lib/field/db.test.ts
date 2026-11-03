import { afterEach, describe, expect, it } from 'vitest'
import { getCampoDB, resetCampoDB } from './db'

describe('account scoped field databases', () => {
  const databases = [getCampoDB('scope-test-user-a'), getCampoDB('scope-test-user-b')]

  afterEach(async () => {
    await Promise.all(databases.map((database) => resetCampoDB(database)))
  })

  it('uses a distinct IndexedDB database for every authenticated account', async () => {
    expect(databases[0].name).not.toBe(databases[1].name)
    await databases[0].open()
    await databases[1].open()
    await databases[0].outbox.put({ id: 'draft-a', payload: {} as never, estado: 'pendiente', intentos: 0, creadoEn: '', actualizadoEn: '', proximoIntentoEn: '' })
    expect(await databases[0].outbox.count()).toBe(1)
    expect(await databases[1].outbox.count()).toBe(0)
  })
})
