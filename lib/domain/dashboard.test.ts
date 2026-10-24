import { describe, expect, it } from 'vitest'
import {
  SIN_DATO,
  SERVICIOS,
  UMBRAL_COBERTURA_PCT,
  coberturaServicios,
  densidadCeldas,
  distribucionEstados,
  equipamientoResumen,
  resumirLevantamiento,
} from './dashboard'
import type { Parcela } from './types'

function parcela(overrides: Partial<Parcela> & { id: string }): Parcela {
  return {
    nombre: 'Parcela',
    descripcion: '',
    categoria: 'Vivienda',
    ubicacion: { type: 'Point', coordinates: [-66.9, 10.48] },
    gps: { fuente: 'sensor', precision: 8 },
    estado: 'completa',
    modulos: {},
    version: 1,
    creadoEn: '2026-10-24T10:00:00.000Z',
    creadoPor: 'u1',
    actualizadoEn: '2026-10-24T10:00:00.000Z',
    actualizadoPor: 'u1',
    ...overrides,
  }
}

function conInfra(id: string, datos: Record<string, unknown>): Parcela {
  return parcela({ id, modulos: { infraestructura: { version: 1, schemaVersion: 1, datos, actualizadoEn: '', actualizadoPor: 'u1' } } })
}

describe('resumirLevantamiento', () => {
  it('cuenta el avance contra el total esperado', () => {
    const parcelas = [
      parcela({ id: '1', estado: 'completa' }),
      parcela({ id: '2', estado: 'completa' }),
      parcela({ id: '3', estado: 'pendiente' }),
    ]

    const resumen = resumirLevantamiento(parcelas, 283)

    expect(resumen.levantadas).toBe(3)
    expect(resumen.completadas).toBe(2)
    expect(resumen.pendientes).toBe(1)
    expect(resumen.faltantes).toBe(280)
    expect(resumen.avancePct).toBe(1.1)
  })

  it('sin total esperado usa las levantadas y el avance es 100', () => {
    const resumen = resumirLevantamiento([parcela({ id: '1' }), parcela({ id: '2' })])
    expect(resumen.totalEsperado).toBe(2)
    expect(resumen.avancePct).toBe(100)
    expect(resumen.faltantes).toBe(0)
  })

  it('no reporta faltantes negativos si se levantó más de lo esperado', () => {
    const resumen = resumirLevantamiento([parcela({ id: '1' }), parcela({ id: '2' })], 1)
    expect(resumen.faltantes).toBe(0)
    expect(resumen.avancePct).toBe(200)
  })

  it('no divide por cero con un levantamiento vacío', () => {
    const resumen = resumirLevantamiento([], 0)
    expect(resumen.avancePct).toBe(0)
  })

  it('cuenta las de revisión aparte', () => {
    const resumen = resumirLevantamiento([parcela({ id: '1', estado: 'en_revision' })], 10)
    expect(resumen.enRevision).toBe(1)
    expect(resumen.completadas).toBe(0)
    expect(resumen.pendientes).toBe(0)
  })
})

describe('coberturaServicios', () => {
  it('devuelve una entrada por cada servicio del plan', () => {
    const cobertura = coberturaServicios([])
    expect(cobertura).toHaveLength(SERVICIOS.length)
    expect(cobertura.map((c) => c.label)).toContain('Acueducto')
    expect(cobertura.map((c) => c.label)).toContain('Aseo urbano')
  })

  it('cuenta conectadas y no conectadas', () => {
    const parcelas = [
      conInfra('1', { acueducto: 'Conectado' }),
      conInfra('2', { acueducto: 'Conectado' }),
      conInfra('3', { acueducto: 'No conectado' }),
    ]

    const acueducto = coberturaServicios(parcelas).find((c) => c.key === 'acueducto')!
    expect(acueducto.cubiertas).toBe(2)
    expect(acueducto.descubiertas).toBe(1)
    expect(acueducto.declaradas).toBe(3)
    expect(acueducto.coberturaPct).toBe(66.7)
  })

  it('calcula el porcentaje sobre las declaradas, no sobre el total', () => {
    // Diez parcelas, solo dos declararon el acueducto y ambas lo tienen.
    const parcelas = [
      ...Array.from({ length: 8 }, (_, i) => parcela({ id: `sin-${i}` })),
      conInfra('a', { acueducto: 'Conectado' }),
      conInfra('b', { acueducto: 'Conectado' }),
    ]

    const acueducto = coberturaServicios(parcelas).find((c) => c.key === 'acueducto')!
    expect(acueducto.declaradas).toBe(2)
    expect(acueducto.sinDato).toBe(8)
    expect(acueducto.coberturaPct).toBe(100)
  })

  it('trata "Sin dato" y la ausencia como sin dato', () => {
    const parcelas = [
      conInfra('1', { acueducto: SIN_DATO }),
      conInfra('2', { acueducto: '' }),
      parcela({ id: '3' }),
    ]

    const acueducto = coberturaServicios(parcelas).find((c) => c.key === 'acueducto')!
    expect(acueducto.sinDato).toBe(3)
    expect(acueducto.declaradas).toBe(0)
    expect(acueducto.enDeficit).toBe(false)
  })

  it('no declara déficit sin datos', () => {
    const acueducto = coberturaServicios([parcela({ id: '1' })]).find((c) => c.key === 'acueducto')!
    expect(acueducto.coberturaPct).toBe(0)
    expect(acueducto.enDeficit).toBe(false)
  })

  it('marca déficit cuando la cobertura está por debajo del umbral', () => {
    const parcelas = [
      conInfra('1', { electricidad: 'Conectado' }),
      conInfra('2', { electricidad: 'No conectado' }),
      conInfra('3', { electricidad: 'No conectado' }),
    ]

    const electricidad = coberturaServicios(parcelas).find((c) => c.key === 'electricidad')!
    expect(electricidad.coberturaPct).toBe(33.3)
    expect(electricidad.enDeficit).toBe(true)
  })

  it('drenaje cubierto solo si es subterráneo o mixto', () => {
    const parcelas = [
      conInfra('1', { drenaje: 'Subterráneo' }),
      conInfra('2', { drenaje: 'A cielo abierto' }),
    ]

    const drenaje = coberturaServicios(parcelas).find((c) => c.key === 'drenaje')!
    expect(drenaje.cubiertas).toBe(1)
    expect(drenaje.descubiertas).toBe(1)
  })

  it('vialidad pavimentada cuenta como cobertura', () => {
    const parcelas = [
      conInfra('1', { vialidad: 'Asfalto' }),
      conInfra('2', { vialidad: 'Tierra' }),
    ].map((p) => ({
      ...p,
      modulos: { equipamiento: { ...p.modulos.infraestructura!, datos: p.modulos.infraestructura!.datos } },
    }))

    const vialidad = coberturaServicios(parcelas).find((c) => c.key === 'vialidad')!
    expect(vialidad.cubiertas).toBe(1)
    expect(vialidad.descubiertas).toBe(1)
  })

  it('respeta un umbral distinto', () => {
    const parcelas = [
      conInfra('1', { acueducto: 'Conectado' }),
      conInfra('2', { acueducto: 'No conectado' }),
    ]

    const conUmbralBajo = coberturaServicios(parcelas, 40).find((c) => c.key === 'acueducto')!
    const conUmbralAlto = coberturaServicios(parcelas, 90).find((c) => c.key === 'acueducto')!

    expect(conUmbralBajo.enDeficit).toBe(false)
    expect(conUmbralAlto.enDeficit).toBe(true)
  })

  it('el umbral por defecto es 80', () => {
    expect(UMBRAL_COBERTURA_PCT).toBe(80)
  })
})

describe('equipamientoResumen', () => {
  function conEquipamiento(id: string, tipo: string): Parcela {
    return parcela({
      id,
      modulos: {
        equipamiento: { version: 1, schemaVersion: 1, datos: { equipamientos: tipo }, actualizadoEn: '', actualizadoPor: 'u1' },
      },
    })
  }

  it('cuenta por tipo y ordena de mayor a menor', () => {
    const resumen = equipamientoResumen([
      conEquipamiento('1', 'Escuela'),
      conEquipamiento('2', 'Escuela'),
      conEquipamiento('3', 'Iglesia'),
    ])

    expect(resumen[0].tipo).toBe('Escuela')
    expect(resumen[0].cantidad).toBe(2)
    expect(resumen[1].tipo).toBe('Iglesia')
  })

  it('calcula parcelas por unidad', () => {
    const resumen = equipamientoResumen([
      conEquipamiento('1', 'Escuela'),
      parcela({ id: '2' }),
      parcela({ id: '3' }),
      parcela({ id: '4' }),
    ])

    expect(resumen[0].parcelasPorUnidad).toBe(4)
  })

  it('marca saturación por encima del umbral', () => {
    const parcelas = [
      conEquipamiento('1', 'Escuela'),
      ...Array.from({ length: 150 }, (_, i) => parcela({ id: `p${i}` })),
    ]

    const resumen = equipamientoResumen(parcelas, 100)
    expect(resumen[0].saturado).toBe(true)
  })

  it('ignora "Sin dato" y los valores vacíos', () => {
    const resumen = equipamientoResumen([
      conEquipamiento('1', SIN_DATO),
      conEquipamiento('2', '  '),
    ])
    expect(resumen).toEqual([])
  })
})

describe('densidadCeldas', () => {
  it('agrupa parcelas cercanas en una celda', () => {
    const celdas = densidadCeldas([
      parcela({ id: '1', ubicacion: { type: 'Point', coordinates: [-66.9001, 10.4801] } }),
      parcela({ id: '2', ubicacion: { type: 'Point', coordinates: [-66.9002, 10.4802] } }),
    ])

    expect(celdas).toHaveLength(1)
    expect(celdas[0].count).toBe(2)
  })

  it('separa parcelas lejanas en celdas distintas', () => {
    const celdas = densidadCeldas([
      parcela({ id: '1', ubicacion: { type: 'Point', coordinates: [-66.9, 10.48] } }),
      parcela({ id: '2', ubicacion: { type: 'Point', coordinates: [-66.89, 10.49] } }),
    ])

    expect(celdas).toHaveLength(2)
  })

  it('devuelve el centroide de la celda', () => {
    const celdas = densidadCeldas([
      parcela({ id: '1', ubicacion: { type: 'Point', coordinates: [-66.9001, 10.4801] } }),
      parcela({ id: '2', ubicacion: { type: 'Point', coordinates: [-66.9003, 10.4803] } }),
    ])

    expect(celdas[0].lng).toBeCloseTo(-66.9002, 6)
    expect(celdas[0].lat).toBeCloseTo(10.4802, 6)
  })

  it('ignora coordenadas inválidas', () => {
    const celdas = densidadCeldas([
      parcela({ id: '1', ubicacion: { type: 'Point', coordinates: [NaN, 10.48] } }),
    ])
    expect(celdas).toEqual([])
  })

  it('devuelve vacío con un tamaño de celda inválido', () => {
    expect(densidadCeldas([parcela({ id: '1' })], 0)).toEqual([])
  })
})

describe('distribucionEstados', () => {
  it('cuenta por estado', () => {
    const distribucion = distribucionEstados([
      parcela({ id: '1', estado: 'completa' }),
      parcela({ id: '2', estado: 'pendiente' }),
      parcela({ id: '3', estado: 'pendiente' }),
    ])

    expect(distribucion.map((d) => d.cantidad)).toEqual([1, 2, 0])
  })
})
