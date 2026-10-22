import { describe, expect, it } from 'vitest'
import {
  fromGeoPoint,
  isUsablePolygon,
  polygonAreaM2,
  polygonPerimeterM,
  toGeoPoint,
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
