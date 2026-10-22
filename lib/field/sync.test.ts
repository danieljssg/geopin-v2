import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import { CampoDB } from './db'
import { enqueueParcela, getConflictedEntries, getEnviableEntries } from './outbox'
import { runSync } from './sync'

let db: CampoDB
let contador = 0

function payload(id: string): ParcelaCreateRequest {
  return {
    id,
    nombre: `Parcela ${id}`,
    descripcion: '',
    categoria: 'Vivienda',
    ubicacion: { lat: 10.48, lng: -66.9 },
    gps: { fuente: 'sensor', precision: 8 },
    estado: 'pendiente',
    modulos: [],
  }
}

function respuestaFalsa(cuerpo: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => cuerpo,
  } as unknown as Response
}

beforeEach(async () => {
  contador += 1
  db = new CampoDB(`test-sync-${contador}-${Date.now()}`)
  await db.open()
})

describe('runSync', () => {
  it('no hace nada si no hay red', async () => {
    await enqueueParcela(payload('p1'), { db })
    const fetchImpl = vi.fn()

    const resumen = await runSync({ db, fetchImpl, isOnline: () => false })

    expect(resumen.omitida).toBe(true)
    expect(resumen.enviadas).toBe(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('no hace nada si la cola está vacía', async () => {
    const fetchImpl = vi.fn()

    const resumen = await runSync({ db, fetchImpl, isOnline: () => true })

    expect(resumen.enviadas).toBe(0)
    expect(resumen.omitida).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('manda la cola y confirma lo que el servidor aceptó', async () => {
    await enqueueParcela(payload('p1'), { db })
    await enqueueParcela(payload('p2'), { db })

    const fetchImpl = vi.fn().mockResolvedValue(
      respuestaFalsa({
        resultados: [
          { id: 'p1', estado: 'creado', moduleVersions: { edificacion: 1 } },
          { id: 'p2', estado: 'creado', moduleVersions: { edificacion: 1 } },
        ],
      }),
    )

    const resumen = await runSync({ db, fetchImpl, isOnline: () => true, random: () => 0.5 })

    expect(resumen.enviadas).toBe(2)
    expect(resumen.confirmadas).toBe(2)
    expect(await getEnviableEntries(Date.now(), { db })).toHaveLength(0)
  })

  it('manda las credenciales de sesión', async () => {
    await enqueueParcela(payload('p1'), { db })
    const fetchImpl = vi.fn().mockResolvedValue(respuestaFalsa({ resultados: [] }))

    await runSync({ db, fetchImpl, isOnline: () => true })

    const [, opciones] = fetchImpl.mock.calls[0]
    expect(opciones.method).toBe('POST')
    expect(opciones.credentials).toBe('same-origin')
    expect(opciones.headers['Content-Type']).toBe('application/json')
  })

  it('reintenta con backoff cuando la red se cae', async () => {
    const ahora = 1_700_000_000_000
    // La entrada se encola con el mismo reloj que usa el sync, si no queda
    // programada para más adelante y todavía no es enviable.
    await enqueueParcela(payload('p1'), { db, now: new Date(ahora).toISOString() })
    const fetchImpl = vi.fn().mockRejectedValue(new Error('Failed to fetch'))

    const resumen = await runSync({
      db,
      fetchImpl,
      isOnline: () => true,
      random: () => 0.5,
      now: () => ahora,
    })

    expect(resumen.reintentadas).toBe(1)
    expect(resumen.error).toContain('Failed to fetch')

    // La entrada sigue en la cola, pero reprogramada para más tarde.
    expect(await getEnviableEntries(ahora, { db })).toHaveLength(0)
    expect(await getEnviableEntries(ahora + 60_000, { db })).toHaveLength(1)
  })

  it('reintenta cuando el servidor responde con error', async () => {
    await enqueueParcela(payload('p1'), { db })
    const fetchImpl = vi.fn().mockResolvedValue(respuestaFalsa({}, false, 500))

    const resumen = await runSync({ db, fetchImpl, isOnline: () => true })

    expect(resumen.reintentadas).toBe(1)
    expect(resumen.error).toContain('500')
  })

  it('deja los conflictos en la cola sin reintentarlos', async () => {
    await enqueueParcela(payload('p1'), { db })

    const fetchImpl = vi.fn().mockResolvedValue(
      respuestaFalsa({
        resultados: [
          {
            id: 'p1',
            estado: 'conflicto',
            conflictos: [
              {
                moduleId: 'edificacion',
                baseVersion: 1,
                currentVersion: 2,
                currentDatos: {},
                actualizadoPor: 'u2',
                actualizadoEn: '2026-10-22T11:00:00.000Z',
              },
            ],
          },
        ],
      }),
    )

    const resumen = await runSync({ db, fetchImpl, isOnline: () => true })

    expect(resumen.conflictos).toBe(1)
    expect(resumen.reintentadas).toBe(0)
    expect(await getConflictedEntries({ db })).toHaveLength(1)
    // No se vuelve a enviar sola: reintentarlo daría el mismo conflicto.
    expect(await getEnviableEntries(Date.now(), { db })).toHaveLength(0)
  })

  it('reintenta las entradas que el servidor no mencionó', async () => {
    await enqueueParcela(payload('p1'), { db })
    const fetchImpl = vi.fn().mockResolvedValue(respuestaFalsa({ resultados: [] }))

    const resumen = await runSync({ db, fetchImpl, isOnline: () => true })

    expect(resumen.reintentadas).toBe(1)
  })

  it('no manda más de lo que entra en una tanda', async () => {
    for (let i = 0; i < 105; i += 1) {
      await enqueueParcela(payload(`p${i}`), { db })
    }

    const fetchImpl = vi.fn().mockResolvedValue(respuestaFalsa({ resultados: [] }))

    const resumen = await runSync({ db, fetchImpl, isOnline: () => true })

    expect(resumen.enviadas).toBe(100)
  })
})
