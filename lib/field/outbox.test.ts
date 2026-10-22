import { beforeEach, describe, expect, it } from 'vitest'
import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import { CampoDB } from './db'
import {
  applySyncPlan,
  countPending,
  enqueueParcela,
  getConflictedEntries,
  getEnviableEntries,
} from './outbox'

let db: CampoDB
let contador = 0

function payload(id: string, nombre = 'Casa'): ParcelaCreateRequest {
  return {
    id,
    nombre,
    descripcion: '',
    categoria: 'Vivienda',
    ubicacion: { lat: 10.48, lng: -66.9 },
    gps: { fuente: 'sensor', precision: 8 },
    estado: 'pendiente',
    modulos: [],
  }
}

beforeEach(async () => {
  contador += 1
  db = new CampoDB(`test-campo-${contador}-${Date.now()}`)
  await db.open()
})

describe('enqueueParcela', () => {
  it('encola una parcela', async () => {
    const entrada = await enqueueParcela(payload('p1'), { db })

    expect(entrada.id).toBe('p1')
    expect(entrada.estado).toBe('pendiente')
    expect(entrada.intentos).toBe(0)
    expect(await countPending({ db })).toBe(1)
  })

  it('reemplaza en vez de duplicar cuando se encola dos veces la misma parcela', async () => {
    await enqueueParcela(payload('p1', 'Casa original'), { db })
    await enqueueParcela(payload('p1', 'Casa corregida'), { db })

    expect(await countPending({ db })).toBe(1)
    const entradas = await getEnviableEntries(Date.now(), { db })
    expect(entradas[0].payload.nombre).toBe('Casa corregida')
  })

  it('reinicia los intentos cuando el dato cambia', async () => {
    await enqueueParcela(payload('p1'), { db })
    await applySyncPlan(
      [
        {
          id: 'p1',
          accion: 'reintentar',
          intentos: 3,
          proximoIntentoEn: new Date(Date.now() + 60_000).toISOString(),
          ultimoError: 'falló',
        },
      ],
      { db },
    )

    await enqueueParcela(payload('p1', 'Corregida'), { db })

    const entradas = await getEnviableEntries(Date.now(), { db })
    expect(entradas[0].intentos).toBe(0)
    expect(entradas[0].ultimoError).toBeUndefined()
    expect(entradas[0].payload.nombre).toBe('Corregida')
  })

  it('conserva la fecha de creación original', async () => {
    const primera = await enqueueParcela(payload('p1'), {
      db,
      now: '2026-10-22T10:00:00.000Z',
    })
    const segunda = await enqueueParcela(payload('p1'), {
      db,
      now: '2026-10-22T11:00:00.000Z',
    })

    expect(segunda.creadoEn).toBe(primera.creadoEn)
    expect(segunda.actualizadoEn).toBe('2026-10-22T11:00:00.000Z')
  })
})

describe('getEnviableEntries', () => {
  it('respeta el momento del próximo intento', async () => {
    await enqueueParcela(payload('p1'), { db })
    await applySyncPlan(
      [
        {
          id: 'p1',
          accion: 'reintentar',
          intentos: 1,
          proximoIntentoEn: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
      { db },
    )

    expect(await getEnviableEntries(Date.now(), { db })).toHaveLength(0)
    expect(await getEnviableEntries(Date.now() + 120_000, { db })).toHaveLength(1)
  })

  it('deja afuera las entradas en conflicto', async () => {
    await enqueueParcela(payload('p1'), { db })
    await applySyncPlan(
      [
        {
          id: 'p1',
          accion: 'conflicto',
          intentos: 1,
          proximoIntentoEn: new Date().toISOString(),
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
      { db },
    )

    expect(await getEnviableEntries(Date.now(), { db })).toHaveLength(0)
    expect(await getConflictedEntries({ db })).toHaveLength(1)
  })

  it('ordena por fecha de creación', async () => {
    await enqueueParcela(payload('b'), { db, now: '2026-10-22T12:00:00.000Z' })
    await enqueueParcela(payload('a'), { db, now: '2026-10-22T10:00:00.000Z' })

    const entradas = await getEnviableEntries(Date.now(), { db })
    expect(entradas.map((e) => e.id)).toEqual(['a', 'b'])
  })
})

describe('applySyncPlan', () => {
  it('saca las entradas confirmadas de la cola', async () => {
    await enqueueParcela(payload('p1'), { db })

    await applySyncPlan(
      [{ id: 'p1', accion: 'confirmado', intentos: 0, proximoIntentoEn: new Date().toISOString() }],
      { db },
    )

    expect(await countPending({ db })).toBe(0)
  })

  it('programa el reintento de las que fallaron', async () => {
    await enqueueParcela(payload('p1'), { db })

    await applySyncPlan(
      [
        {
          id: 'p1',
          accion: 'reintentar',
          intentos: 2,
          proximoIntentoEn: '2026-10-22T12:00:00.000Z',
          ultimoError: 'red caída',
        },
      ],
      { db },
    )

    const entradas = await getAllEntriesSafe(db)
    expect(entradas[0].estado).toBe('fallido')
    expect(entradas[0].intentos).toBe(2)
    expect(entradas[0].ultimoError).toBe('red caída')
  })

  it('guarda el detalle del conflicto', async () => {
    await enqueueParcela(payload('p1'), { db })

    await applySyncPlan(
      [
        {
          id: 'p1',
          accion: 'conflicto',
          intentos: 1,
          proximoIntentoEn: new Date().toISOString(),
          conflictos: [
            {
              moduleId: 'edificacion',
              baseVersion: 1,
              currentVersion: 3,
              currentDatos: { uso_general: 'Industrial' },
              actualizadoPor: 'u2',
              actualizadoEn: '2026-10-22T11:00:00.000Z',
            },
          ],
        },
      ],
      { db },
    )

    const enConflicto = await getConflictedEntries({ db })
    expect(enConflicto[0].conflictos?.[0]?.currentVersion).toBe(3)
    expect(enConflicto[0].estado).toBe('conflicto')
  })
})

async function getAllEntriesSafe(db: CampoDB) {
  return db.outbox.toArray()
}
