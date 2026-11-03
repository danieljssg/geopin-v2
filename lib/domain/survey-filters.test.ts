import { describe, expect, it } from 'vitest'
import type { Parcela } from './types'
import { filterSurveyRecords, parseSurveyFilters } from './survey-filters'

function record(id: string, overrides: Partial<Parcela> = {}): Parcela {
  return { id, nombre: id, descripcion: '', categoria: 'Vivienda', ubicacion: { type: 'Point', coordinates: [0, 0] }, gps: { fuente: 'manual' }, estado: 'completa', modulos: {}, version: 1, creadoEn: '2026-01-02T15:00:00.000Z', creadoPor: id, actualizadoEn: '2026-01-04T12:00:00.000Z', actualizadoPor: id, ...overrides }
}

describe('survey filters', () => {
  it('applies an inclusive UTC date range and multi-select AND dimensions', () => {
    const matches = record('one', { categoria: 'Vivienda', modulos: { edificacion: { version: 1, schemaVersion: 1, datos: { uso_general: 'Residencial', material: 'Bloque' }, actualizadoEn: '', actualizadoPor: 'one' } } })
    const other = record('two', { categoria: 'Comercio' })
    const filters = parseSurveyFilters(new URLSearchParams('from=2026-01-02&to=2026-01-02&category=Vivienda&generalUse=Residencial'))
    expect(filterSurveyRecords([matches, other], filters).map((item) => item.id)).toEqual(['one'])
  })

  it('returns an empty result for reversed ranges and filters by last modification when selected', () => {
    const filters = parseSurveyFilters(new URLSearchParams('dateField=updatedAt&from=2026-01-05&to=2026-01-02'))
    expect(filterSurveyRecords([record('one')], filters)).toEqual([])
    const valid = parseSurveyFilters(new URLSearchParams('dateField=updatedAt&from=2026-01-04&to=2026-01-04'))
    expect(filterSurveyRecords([record('one')], valid)).toHaveLength(1)
  })
})
