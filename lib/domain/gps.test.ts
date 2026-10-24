import { describe, expect, it } from 'vitest'
import {
  ACCURACY_THRESHOLD_M,
  fixFrom,
  fixMessage,
  formatAccuracy,
  isUsable,
  qualityOf,
  shouldFollowSensor,
  type GpsReading,
} from './gps'

function lectura(accuracy: number): GpsReading {
  return { lat: 10.48, lng: -66.9, accuracy, timestamp: 1_700_000_000_000 }
}

describe('isUsable', () => {
  it('acepta lecturas dentro del umbral', () => {
    expect(isUsable(1)).toBe(true)
    expect(isUsable(ACCURACY_THRESHOLD_M)).toBe(true)
  })

  it('rechaza lecturas por encima del umbral', () => {
    expect(isUsable(15.1)).toBe(false)
    expect(isUsable(30)).toBe(false)
    expect(isUsable(60)).toBe(false)
  })

  it('rechaza cero, negativos y valores no numéricos', () => {
    expect(isUsable(0)).toBe(false)
    expect(isUsable(-5)).toBe(false)
    expect(isUsable(undefined)).toBe(false)
    expect(isUsable(null)).toBe(false)
    expect(isUsable(NaN)).toBe(false)
  })
})

describe('qualityOf', () => {
  it('clasifica por tramos', () => {
    expect(qualityOf(3)).toBe('excelente')
    expect(qualityOf(5)).toBe('excelente')
    expect(qualityOf(12)).toBe('buena')
    expect(qualityOf(40)).toBe('imprecisa')
    expect(qualityOf(0)).toBe('sin-dato')
    expect(qualityOf(undefined)).toBe('sin-dato')
  })
})

describe('shouldFollowSensor', () => {
  it('mueve el pin con una lectura buena y origen sensor', () => {
    expect(shouldFollowSensor('sensor', lectura(8))).toBe(true)
  })

  it('no mueve el pin con una lectura imprecisa', () => {
    expect(shouldFollowSensor('sensor', lectura(30))).toBe(false)
    expect(shouldFollowSensor('sensor', lectura(16))).toBe(false)
  })

  it('no mueve el pin si la posición es manual, aunque la lectura sea perfecta', () => {
    expect(shouldFollowSensor('manual', lectura(2))).toBe(false)
  })

  it('no mueve el pin sin lectura', () => {
    expect(shouldFollowSensor('sensor', null)).toBe(false)
    expect(shouldFollowSensor('sensor', undefined)).toBe(false)
  })

  it('respeta un umbral distinto', () => {
    expect(shouldFollowSensor('sensor', lectura(20), 25)).toBe(true)
    expect(shouldFollowSensor('sensor', lectura(20), 10)).toBe(false)
  })
})

describe('fixFrom', () => {
  it('distingue los estados', () => {
    expect(fixFrom(null, null, false)).toBe('sin-soporte')
    expect(fixFrom(null, 1, true)).toBe('sin-permiso')
    expect(fixFrom(null, 2, true)).toBe('error')
    expect(fixFrom(null, null, true)).toBe('buscando')
    expect(fixFrom(lectura(5), null, true)).toBe('fijado')
    expect(fixFrom(lectura(40), null, true)).toBe('impreciso')
  })

  it('trata el código 0 como ausencia de error', () => {
    expect(fixFrom(lectura(5), 0, true)).toBe('fijado')
  })
})

describe('formatAccuracy', () => {
  it('redondea a metros enteros', () => {
    expect(formatAccuracy(8.4)).toBe('±8 m')
    expect(formatAccuracy(15)).toBe('±15 m')
  })

  it('marca el submetro', () => {
    expect(formatAccuracy(0.4)).toBe('< 1 m')
  })

  it('dice sin dato cuando no hay valor', () => {
    expect(formatAccuracy(0)).toBe('sin dato')
    expect(formatAccuracy(undefined)).toBe('sin dato')
  })
})

describe('fixMessage', () => {
  it('menciona el umbral cuando la precisión no alcanza', () => {
    expect(fixMessage('impreciso')).toContain(String(ACCURACY_THRESHOLD_M))
  })

  it('tiene mensaje para todos los estados', () => {
    for (const fix of ['sin-soporte', 'sin-permiso', 'buscando', 'fijado', 'impreciso', 'error'] as const) {
      expect(fixMessage(fix).length).toBeGreaterThan(0)
    }
  })
})
