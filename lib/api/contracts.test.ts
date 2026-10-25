import { describe, expect, it } from 'vitest'
import {
  MAX_LIST_LIMIT,
  MAX_SYNC_BATCH,
  parseListQuery,
  parseParcelaCreate,
  parseParcelaPatch,
  parseSyncRequest,
} from './contracts'

const VALIDA = {
  id: 'parcela-1',
  nombre: 'Casa en la esquina',
  descripcion: 'Vivienda unifamiliar de dos pisos',
  categoria: 'Vivienda',
  ubicacion: { lat: 10.4806, lng: -66.9036 },
  gps: { fuente: 'sensor', precision: 8 },
  estado: 'pendiente',
}

describe('parseParcelaCreate', () => {
  it('acepta una petición válida', () => {
    const parsed = parseParcelaCreate(VALIDA)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.nombre).toBe('Casa en la esquina')
    expect(parsed.value.descripcion).toBe('Vivienda unifamiliar de dos pisos')
    expect(parsed.value.estado).toBe('pendiente')
  })

  it('rechaza un cuerpo que no es un objeto', () => {
    expect(parseParcelaCreate('hola').ok).toBe(false)
    expect(parseParcelaCreate([]).ok).toBe(false)
    expect(parseParcelaCreate(null).ok).toBe(false)
  })

  it('exige el id del cliente', () => {
    const { id, ...sinId } = VALIDA
    const parsed = parseParcelaCreate(sinId)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain('id')
  })

  it('exige nombre y categoría', () => {
    expect(parseParcelaCreate({ ...VALIDA, nombre: '' }).ok).toBe(false)
    expect(parseParcelaCreate({ ...VALIDA, categoria: '   ' }).ok).toBe(false)
  })

  it('rechaza latitudes y longitudes fuera de rango', () => {
    expect(parseParcelaCreate({ ...VALIDA, ubicacion: { lat: 91, lng: 0 } }).ok).toBe(false)
    expect(parseParcelaCreate({ ...VALIDA, ubicacion: { lat: 0, lng: 181 } }).ok).toBe(false)
    expect(parseParcelaCreate({ ...VALIDA, ubicacion: { lat: 10, lng: -66 } }).ok).toBe(true)
  })

  it('rechaza un origen de GPS desconocido', () => {
    const parsed = parseParcelaCreate({ ...VALIDA, gps: { fuente: 'satélite' } })
    expect(parsed.ok).toBe(false)
  })

  it('rechaza un estado desconocido', () => {
    expect(parseParcelaCreate({ ...VALIDA, estado: 'archivada' }).ok).toBe(false)
  })

  it('rechaza una geometría que no es un polígono válido', () => {
    expect(parseParcelaCreate({ ...VALIDA, geometria: { type: 'Point', coordinates: [1, 2] } }).ok).toBe(false)
    expect(
      parseParcelaCreate({ ...VALIDA, geometria: { type: 'Polygon', coordinates: [] } }).ok,
    ).toBe(false)
    expect(
      parseParcelaCreate({
        ...VALIDA,
        geometria: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1]]] },
      }).ok,
    ).toBe(false)
  })

  it('acepta un polígono bien formado', () => {
    const parsed = parseParcelaCreate({
      ...VALIDA,
      geometria: {
        type: 'Polygon',
        coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
      },
    })
    expect(parsed.ok).toBe(true)
  })

  it('rechaza un área negativa', () => {
    expect(parseParcelaCreate({ ...VALIDA, areaM2: -1 }).ok).toBe(false)
  })

  it('acepta módulos con su versión base', () => {
    const parsed = parseParcelaCreate({
      ...VALIDA,
      modulos: [
        { moduleId: 'edificacion', baseVersion: 0, schemaVersion: 1, datos: { uso_general: 'Residencial' } },
      ],
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.modulos).toHaveLength(1)
    expect(parsed.value.modulos?.[0].baseVersion).toBe(0)
  })

  it('rechaza un módulo sin versión base', () => {
    const parsed = parseParcelaCreate({
      ...VALIDA,
      modulos: [{ moduleId: 'edificacion', schemaVersion: 1, datos: {} }],
    })
    expect(parsed.ok).toBe(false)
  })
})

describe('parseParcelaPatch', () => {
  it('acepta un parche con un solo campo', () => {
    const parsed = parseParcelaPatch({ nombre: 'Nuevo nombre' })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.core?.nombre).toBe('Nuevo nombre')
  })

  it('rechaza un parche vacío', () => {
    const parsed = parseParcelaPatch({})
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain('ningún campo')
  })

  it('acepta un parche solo de módulos', () => {
    const parsed = parseParcelaPatch({
      modulos: [{ moduleId: 'edificacion', baseVersion: 1, schemaVersion: 1, datos: {} }],
    })
    expect(parsed.ok).toBe(true)
  })
})

describe('parseSyncRequest', () => {
  it('acepta una tanda válida', () => {
    const parsed = parseSyncRequest({ parcels: [VALIDA, { ...VALIDA, id: 'parcela-2' }] })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.value.parcels).toHaveLength(2)
  })

  it('acepta una tanda vacía', () => {
    const parsed = parseSyncRequest({ parcels: [] })
    expect(parsed.ok).toBe(true)
  })

  it('rechaza una tanda que supera el máximo', () => {
    const parcels = Array.from({ length: MAX_SYNC_BATCH + 1 }, (_, index) => ({
      ...VALIDA,
      id: `parcela-${index}`,
    }))
    const parsed = parseSyncRequest({ parcels })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain(String(MAX_SYNC_BATCH))
  })

  it('rechaza una parcela inválida dentro de la tanda', () => {
    const parsed = parseSyncRequest({ parcels: [{ ...VALIDA, nombre: '' }] })
    expect(parsed.ok).toBe(false)
  })

  it('rechaza un cuerpo sin la lista de parcelas', () => {
    expect(parseSyncRequest({}).ok).toBe(false)
    expect(parseSyncRequest({ parcels: 'no' }).ok).toBe(false)
  })
})

describe('parseListQuery', () => {
  it('aplica valores por defecto', () => {
    const query = parseListQuery(new URL('https://x.test/api/parcelas'))
    expect(query.limite).toBe(50)
    expect(query.skip).toBe(0)
    expect(query.estado).toBeUndefined()
  })

  it('acota el límite al máximo permitido', () => {
    const query = parseListQuery(new URL('https://x.test/api/parcelas?limite=9999'))
    expect(query.limite).toBe(MAX_LIST_LIMIT)
  })

  it('descarta un límite negativo o no numérico', () => {
    expect(parseListQuery(new URL('https://x.test/api/parcelas?limite=-5')).limite).toBe(1)
    expect(parseListQuery(new URL('https://x.test/api/parcelas?limite=abc')).limite).toBe(50)
  })

  it('acepta un estado válido e ignora uno inválido', () => {
    expect(parseListQuery(new URL('https://x.test/api/parcelas?estado=completa')).estado).toBe('completa')
    expect(parseListQuery(new URL('https://x.test/api/parcelas?estado=xxx')).estado).toBeUndefined()
  })

  it('conserva el filtro por levantamiento', () => {
    expect(
      parseListQuery(new URL('https://x.test/api/parcelas?levantamientoId=lev-1')).levantamientoId,
    ).toBe('lev-1')
  })

  it('acepta un filtro por creador', () => {
    const query = parseListQuery(new URL('https://x.test/api/parcelas?creadoPor=user-123'))
    expect(query.creadoPor).toBe('user-123')
  })

  it('descarta un creador vacío', () => {
    expect(parseListQuery(new URL('https://x.test/api/parcelas?creadoPor=')).creadoPor).toBeUndefined()
    expect(
      parseListQuery(new URL('https://x.test/api/parcelas?creadoPor=%20')).creadoPor,
    ).toBeUndefined()
  })
})
