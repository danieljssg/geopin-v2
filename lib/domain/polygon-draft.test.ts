import { describe, expect, it } from 'vitest'
import {
  MIN_VERTICES,
  addVertex,
  clearDraft,
  closeDraft,
  draftAreaM2,
  draftPerimeterM,
  emptyDraft,
  moveVertex,
  removeVertex,
  ringFromDraft,
  seCruza,
  undoVertex,
} from './polygon-draft'
import type { Draft } from './polygon-draft'

/** Cuadrado de 0,001° × 0,001° sobre el ecuador: 111,13 m de lado. */
const LADO = 111_132.92 * 0.001
const CUADRADO: Draft = [
  { lng: 0, lat: 0 },
  { lng: 0.001, lat: 0 },
  { lng: 0.001, lat: 0.001 },
  { lng: 0, lat: 0.001 },
]

describe('addVertex', () => {
  it('agrega al final', () => {
    const { draft } = addVertex(emptyDraft(), { lng: -66.9, lat: 10.48 })
    expect(draft).toHaveLength(1)
  })

  it('rechaza un vértice encima del anterior', () => {
    const primero = addVertex(emptyDraft(), { lng: -66.9, lat: 10.48 })
    const segundo = addVertex(primero.draft, { lng: -66.9 + 1e-9, lat: 10.48 })

    expect(segundo.draft).toHaveLength(1)
    expect(segundo.rechazo).toMatch(/ya hay un vértice/i)
  })

  it('rechaza coordenadas fuera del mapa', () => {
    expect(addVertex(emptyDraft(), { lng: 200, lat: 0 }).rechazo).toBeTruthy()
    expect(addVertex(emptyDraft(), { lng: 0, lat: 95 }).rechazo).toBeTruthy()
  })

  it('rechaza coordenadas no finitas', () => {
    expect(addVertex(emptyDraft(), { lng: NaN, lat: 0 }).rechazo).toBeTruthy()
  })
})

describe('removeVertex', () => {
  it('quita el vértice indicado', () => {
    expect(removeVertex(CUADRADO, 1)).toHaveLength(3)
    expect(removeVertex(CUADRADO, 1)[1]).toEqual(CUADRADO[2])
  })

  it('ignora un índice inexistente', () => {
    expect(removeVertex(CUADRADO, 99)).toBe(CUADRADO)
    expect(removeVertex(CUADRADO, -1)).toBe(CUADRADO)
  })
})

describe('moveVertex', () => {
  it('mueve el vértice indicado', () => {
    const movido = moveVertex(CUADRADO, 0, { lng: -0.001, lat: -0.001 })
    expect(movido[0]).toEqual({ lng: -0.001, lat: -0.001 })
    expect(movido[1]).toEqual(CUADRADO[1])
  })

  it('ignora coordenadas inválidas', () => {
    expect(moveVertex(CUADRADO, 0, { lng: NaN, lat: 0 })).toBe(CUADRADO)
  })
})

describe('undoVertex', () => {
  it('quita el último', () => {
    expect(undoVertex(CUADRADO)).toHaveLength(3)
  })

  it('no rompe con un borrador vacío', () => {
    expect(undoVertex(emptyDraft())).toEqual([])
  })
})

describe('clearDraft', () => {
  it('devuelve un borrador vacío', () => {
    expect(clearDraft()).toEqual([])
  })
})

describe('ringFromDraft', () => {
  it('cierra el anillo con el primer punto', () => {
    const anillo = ringFromDraft(CUADRADO)
    expect(anillo).toHaveLength(CUADRADO.length + 1)
    expect(anillo[anillo.length - 1]).toEqual(anillo[0])
  })

  it('no duplica el cierre si ya viene cerrado', () => {
    const cerrado = [...CUADRADO, { lng: 0, lat: 0 }]
    const anillo = ringFromDraft(cerrado)
    expect(anillo).toHaveLength(cerrado.length)
  })

  it('devuelve vacío para un borrador vacío', () => {
    expect(ringFromDraft([])).toEqual([])
  })
})

describe('draftAreaM2', () => {
  it('calcula el área de un cuadrado conocido', () => {
    expect(draftAreaM2(CUADRADO)).toBeCloseTo(LADO * LADO, 2)
  })

  it('devuelve cero con menos de tres vértices', () => {
    expect(draftAreaM2([])).toBe(0)
    expect(draftAreaM2(CUADRADO.slice(0, 2))).toBe(0)
  })

  it('no depende del sentido de recorrido', () => {
    expect(draftAreaM2([...CUADRADO].reverse())).toBeCloseTo(draftAreaM2(CUADRADO), 6)
  })
})

describe('draftPerimeterM', () => {
  it('calcula el perímetro de un cuadrado conocido', () => {
    expect(draftPerimeterM(CUADRADO)).toBeCloseTo(LADO * 4, 2)
  })

  it('devuelve cero con menos de tres vértices', () => {
    expect(draftPerimeterM(CUADRADO.slice(0, 2))).toBe(0)
  })
})

describe('closeDraft', () => {
  it('cierra un polígono válido', () => {
    const result = closeDraft(CUADRADO)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.geometria.type).toBe('Polygon')
    expect(result.geometria.coordinates[0]).toHaveLength(5)
    expect(result.areaM2).toBeCloseTo(LADO * LADO, 2)
    expect(result.perimetroM).toBeCloseTo(LADO * 4, 2)
  })

  it('rechaza menos de tres vértices', () => {
    const result = closeDraft(CUADRADO.slice(0, 2))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain(String(MIN_VERTICES))
  })

  it('rechaza vértices alineados', () => {
    const alineados: Draft = [
      { lng: 0, lat: 0 },
      { lng: 0.001, lat: 0 },
      { lng: 0.002, lat: 0 },
    ]
    const result = closeDraft(alineados)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/área despreciable/i)
  })

  it('rechaza un contorno que se cruza', () => {
    // Un "8" o un lazo: los lados se cruzan y el área no tiene sentido.
    const cruzado: Draft = [
      { lng: 0, lat: 0 },
      { lng: 0.002, lat: 0.002 },
      { lng: 0.002, lat: 0 },
      { lng: 0, lat: 0.002 },
    ]
    const result = closeDraft(cruzado)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/cruzan/i)
  })
})

describe('seCruza', () => {
  it('dice que no para un cuadrado', () => {
    expect(seCruza(CUADRADO)).toBe(false)
  })

  it('dice que sí para un lazo', () => {
    expect(
      seCruza([
        { lng: 0, lat: 0 },
        { lng: 0.002, lat: 0.002 },
        { lng: 0.002, lat: 0 },
        { lng: 0, lat: 0.002 },
      ]),
    ).toBe(true)
  })

  it('no marca un triángulo', () => {
    expect(
      seCruza([
        { lng: 0, lat: 0 },
        { lng: 0.001, lat: 0 },
        { lng: 0, lat: 0.001 },
      ]),
    ).toBe(false)
  })
})
