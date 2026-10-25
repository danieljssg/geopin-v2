import { describe, expect, it } from 'vitest'
import type { GeoPoint } from './types'
import {
  fromGeoPoint,
  isUsablePolygon,
  polygonAreaM2,
  polygonPerimeterM,
  toGeoPoint,
  ubicacionDeParcela,
  ubicacionPersistida,
} from './parcela'

/**
 * El cuadrado de prueba mide 0.001° × 0.001° sobre el ecuador, donde un
 * grado equivale exactamente a los 111.132,92 m que usa la fórmula. El área
 * esperada sale de multiplicar los lados.
 */
const CUADRADO: number[][][] = [
  [
    [0, 0],
    [0.001, 0],
    [0.001, 0.001],
    [0, 0.001],
    [0, 0],
  ],
]

const LADO = 111_132.92 * 0.001

describe('toGeoPoint', () => {
  it('invierte el orden a longitud, latitud', () => {
    const point = toGeoPoint({ lat: 10.4806, lng: -66.9036 })
    expect(point.type).toBe('Point')
    expect(point.coordinates).toEqual([-66.9036, 10.4806])
  })
})

describe('fromGeoPoint', () => {
  it('vuelve a latitud, longitud', () => {
    const ubicacion = fromGeoPoint({ type: 'Point', coordinates: [-66.9036, 10.4806] })
    expect(ubicacion).toEqual({ lat: 10.4806, lng: -66.9036 })
  })

  it('hace ida y vuelta sin perder precisión', () => {
    const original = { lat: 10.480612, lng: -66.903645 }
    expect(fromGeoPoint(toGeoPoint(original))).toEqual(original)
  })
})

describe('polygonAreaM2', () => {
  it('calcula el área de un cuadrado de un lado conocido', () => {
    expect(polygonAreaM2(CUADRADO)).toBeCloseTo(LADO * LADO, 2)
  })

  it('devuelve cero para una geometría degenerada', () => {
    expect(polygonAreaM2([])).toBe(0)
    expect(polygonAreaM2([[[0, 0], [1, 1]]])).toBe(0)
  })

  it('no depende del sentido en que se recorren los vértices', () => {
    const horario = CUADRADO[0]
    const antihorario = [...horario].reverse()
    expect(polygonAreaM2([antihorario])).toBeCloseTo(polygonAreaM2([horario]), 6)
  })
})

describe('polygonPerimeterM', () => {
  it('calcula el perímetro de un cuadrado de un lado conocido', () => {
    expect(polygonPerimeterM(CUADRADO)).toBeCloseTo(LADO * 4, 2)
  })

  it('devuelve cero para una geometría degenerada', () => {
    expect(polygonPerimeterM([])).toBe(0)
  })
})

describe('isUsablePolygon', () => {
  it('acepta un polígono cerrado con al menos cuatro vértices', () => {
    expect(isUsablePolygon(CUADRADO)).toBe(true)
  })

  it('rechaza geometrías ausentes o con vértices inválidos', () => {
    expect(isUsablePolygon(undefined)).toBe(false)
    expect(isUsablePolygon([])).toBe(false)
    expect(isUsablePolygon([[[0, 0], [1, 0], [1, 1]]])).toBe(false)
    expect(isUsablePolygon([[[0, 0], [1, 0], [1, 1], ['x', 0]] as unknown as number[][]])).toBe(false)
  })
})

describe('ubicacionPersistida', () => {
  const ANILLO: number[][][] = [
    [
      [-69.2951, 10.0783],
      [-69.2941, 10.0783],
      [-69.2941, 10.0793],
      [-69.2951, 10.0783],
    ],
  ]
  const PIN = { lat: 10.4806, lng: -66.9036 }

  it('con polígono utilizable persiste su primer vértice como ubicación', () => {
    const punto = ubicacionPersistida(
      { type: 'Polygon', coordinates: ANILLO },
      PIN,
    )

    // La regla de S-bug: la parcela con contorno se guarda donde está el
    // contorno, no donde estaba el pin del dispositivo.
    expect(punto).toEqual({ type: 'Point', coordinates: [-69.2951, 10.0783] })
  })

  it('sin geometría persiste el punto de entrada', () => {
    expect(ubicacionPersistida(undefined, PIN)).toEqual({
      type: 'Point',
      coordinates: [-66.9036, 10.4806],
    })
  })

  it('con geometría vacía o inválida persiste el punto de entrada', () => {
    expect(
      ubicacionPersistida({ type: 'Polygon', coordinates: [] }, PIN),
    ).toEqual({ type: 'Point', coordinates: [-66.9036, 10.4806] })

    expect(
      ubicacionPersistida(
        { type: 'Polygon', coordinates: [[['x', 0]]] as unknown as number[][][] },
        PIN,
      ),
    ).toEqual({ type: 'Point', coordinates: [-66.9036, 10.4806] })
  })
})

describe('ubicacionDeParcela', () => {
  const guardada: GeoPoint = { type: 'Point', coordinates: [-66.9036, 10.4806] }

  const ANILLO: number[][][] = [
    [
      [-66.8, 10.5],
      [-66.79, 10.5],
      [-66.79, 10.51],
      [-66.8, 10.5],
    ],
  ]

  it('usa el primer vértice del polígono, no la ubicación guardada', () => {
    const ubicacion = ubicacionDeParcela({
      ubicacion: guardada,
      geometria: { type: 'Polygon', coordinates: ANILLO },
    })

    // El anillo guarda [longitud, latitud] y la app trabaja en lat/lng.
    expect(ubicacion).toEqual({ lat: 10.5, lng: -66.8 })
  })

  it('sin geometría devuelve la ubicación guardada', () => {
    expect(ubicacionDeParcela({ ubicacion: guardada })).toEqual({
      lat: 10.4806,
      lng: -66.9036,
    })
  })

  it('con geometría vacía o inválida devuelve la ubicación guardada', () => {
    expect(
      ubicacionDeParcela({ ubicacion: guardada, geometria: { type: 'Polygon', coordinates: [] } }),
    ).toEqual({ lat: 10.4806, lng: -66.9036 })

    expect(
      ubicacionDeParcela({
        ubicacion: guardada,
        geometria: { type: 'Polygon', coordinates: [[['x', 0]]] as unknown as number[][][] },
      }),
    ).toEqual({ lat: 10.4806, lng: -66.9036 })
  })
})
