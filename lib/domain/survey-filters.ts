import type { Parcela } from './types'

export interface SurveyFilters {
  dateField: 'createdAt' | 'updatedAt'
  from?: string
  to?: string
  categories: string[]
  generalUses: string[]
  specificUses: string[]
  constructionConditions: string[]
  floors: string[]
  materials: string[]
}

const APP_UTC_OFFSET = '-04:00' // GeoPin's existing es-VE date convention (Venezuela Standard Time).

export function parseSurveyFilters(params: URLSearchParams): SurveyFilters {
  const dateField = params.get('dateField') === 'updatedAt' ? 'updatedAt' : 'createdAt'
  const read = (key: string) => [...new Set(params.getAll(key).flatMap((v) => v.split(',')).map((v) => v.trim()).filter(Boolean))].slice(0, 50)
  return {
    dateField,
    from: validDate(params.get('from')),
    to: validDate(params.get('to')),
    categories: read('category'),
    generalUses: read('generalUse'),
    specificUses: read('specificUse'),
    constructionConditions: read('constructionCondition'),
    floors: read('floors'),
    materials: read('material'),
  }
}

export function filterSurveyRecords(records: readonly Parcela[], filters: SurveyFilters): Parcela[] {
  const from = filters.from ? Date.parse(`${filters.from}T00:00:00.000${APP_UTC_OFFSET}`) : undefined
  const to = filters.to ? Date.parse(`${addDay(filters.to)}T00:00:00.000${APP_UTC_OFFSET}`) : undefined
  if (from !== undefined && to !== undefined && from >= to) return []
  return records.filter((record) => {
    const timestamp = Date.parse(filters.dateField === 'updatedAt' ? record.actualizadoEn : record.creadoEn)
    if (!Number.isFinite(timestamp) || (from !== undefined && timestamp < from) || (to !== undefined && timestamp >= to)) return false
    const data = record.modulos?.edificacion?.datos ?? {}
    return matches(filters.categories, record.categoria) &&
      matches(filters.generalUses, data.uso_general) &&
      matches(filters.specificUses, data.uso_especifico) &&
      matches(filters.constructionConditions, data.estado_construccion) &&
      matches(filters.floors, data.pisos_construccion) &&
      matches(filters.materials, data.material)
  })
}

function matches(selected: string[], value: unknown): boolean {
  if (selected.length === 0) return true
  const values = Array.isArray(value) ? value.map(String) : [String(value ?? '')]
  return selected.some((item) => values.includes(item))
}

function validDate(value: string | null): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : undefined
}

function addDay(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}
