import { describe, expect, it } from 'vitest'
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS, computeBackoffMs, planSync } from './sync-plan'
import type { OutboxEntry } from './types'

const AHORA = 1_700_000_000_000

function entrada(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: 'parcela-1',
    payload: {
      id: 'parcela-1',
      nombre: 'Casa',
      descripcion: '',
      categoria: 'Vivienda',
      ubicacion: { lat: 10.48, lng: -66.9 },
      gps: { fuente: 'sensor' },
      estado: 'pendiente',
      modulos: [],
    },
    estado: 'pendiente',
    intentos: 0,
    creadoEn: '2026-10-22T10:00:00.000Z',
    actualizadoEn: '2026-10-22T10:00:00.000Z',
    proximoIntentoEn: '2026-10-22T10:00:00.000Z',
    ...overrides,
  }
}

describe('computeBackoffMs', () => {
  it('espera lo mismo sin jitter cuando la aleatoriedad es fija', () => {
    expect(computeBackoffMs(1, () => 0.5)).toBe(BACKOFF_BASE_MS)
  })

  it('crece exponencialmente con los intentos', () => {
    const base = computeBackoffMs(1, () => 0.5)
    const doble = computeBackoffMs(2, () => 0.5)
    const cuatro = computeBackoffMs(3, () => 0.5)
    expect(doble).toBe(base * 2)
    expect(cuatro).toBe(base * 4)
  })

  it('no crece sin límite', () => {
    expect(computeBackoffMs(50, () => 0.5)).toBe(BACKOFF_MAX_MS)
  })

  it('aplica jitter entre más y menos 20 por ciento', () => {
    const minimo = computeBackoffMs(1, () => 0)
    const maximo = computeBackoffMs(1, () => 1)
    expect(minimo).toBe(BACKOFF_BASE_MS * 0.8)
    expect(maximo).toBe(BACKOFF_BASE_MS * 1.2)
  })
})

describe('planSync', () => {
  it('confirma una parcela creada', () => {
    const plan = planSync(
      [entrada()],
      new Map([['parcela-1', { id: 'parcela-1', estado: 'creado' }]]),
      AHORA,
      () => 0.5,
    )

    expect(plan.confirmadas).toEqual(['parcela-1'])
    expect(plan.entradas[0].accion).toBe('confirmado')
  })

  it('confirma también las ignoradas, que son reintentos ya aplicados', () => {
    const plan = planSync(
      [entrada()],
      new Map([['parcela-1', { id: 'parcela-1', estado: 'ignorado' }]]),
      AHORA,
      () => 0.5,
    )

    expect(plan.confirmadas).toEqual(['parcela-1'])
  })

  it('marca un conflicto sin reintentar', () => {
    const plan = planSync(
      [entrada()],
      new Map([
        [
          'parcela-1',
          {
            id: 'parcela-1',
            estado: 'conflicto',
            conflictos: [
              {
                moduleId: 'edificacion',
                baseVersion: 1,
                currentVersion: 2,
                currentDatos: {},
                actualizadoPor: 'user-2',
                actualizadoEn: '2026-10-22T11:00:00.000Z',
              },
            ],
          },
        ],
      ]),
      AHORA,
      () => 0.5,
    )

    expect(plan.enConflicto).toEqual(['parcela-1'])
    expect(plan.aReintentar).toEqual([])
    expect(plan.entradas[0].conflictos).toHaveLength(1)
  })

  it('reintenta con backoff cuando el servidor devuelve error', () => {
    const plan = planSync(
      [entrada()],
      new Map([['parcela-1', { id: 'parcela-1', estado: 'error', error: 'Se cayó la red' }]]),
      AHORA,
      () => 0.5,
    )

    expect(plan.aReintentar).toEqual(['parcela-1'])
    const entradaPlanificada = plan.entradas[0]
    expect(entradaPlanificada.intentos).toBe(1)
    expect(entradaPlanificada.ultimoError).toBe('Se cayó la red')
    expect(new Date(entradaPlanificada.proximoIntentoEn).getTime()).toBe(AHORA + BACKOFF_BASE_MS)
  })

  it('reintenta cuando el servidor ni siquiera mencionó la parcela', () => {
    const plan = planSync([entrada()], new Map(), AHORA, () => 0.5)

    expect(plan.aReintentar).toEqual(['parcela-1'])
    expect(plan.confirmadas).toEqual([])
  })

  it('acumula los intentos entre reintentos', () => {
    const plan = planSync(
      [entrada({ intentos: 3 })],
      new Map([['parcela-1', { id: 'parcela-1', estado: 'error' }]]),
      AHORA,
      () => 0.5,
    )

    expect(plan.entradas[0].intentos).toBe(4)
    expect(new Date(plan.entradas[0].proximoIntentoEn).getTime()).toBe(
      AHORA + BACKOFF_BASE_MS * 8,
    )
  })

  it('procesa varias entradas con resultados distintos', () => {
    const plan = planSync(
      [
        entrada({ id: 'a' }),
        entrada({ id: 'b' }),
        entrada({ id: 'c' }),
        entrada({ id: 'd' }),
      ],
      new Map([
        ['a', { id: 'a', estado: 'creado' }],
        ['b', { id: 'b', estado: 'error' }],
        ['c', { id: 'c', estado: 'conflicto' }],
      ]),
      AHORA,
      () => 0.5,
    )

    expect(plan.confirmadas).toEqual(['a'])
    expect(plan.aReintentar).toEqual(['b', 'd'])
    expect(plan.enConflicto).toEqual(['c'])
  })
})
