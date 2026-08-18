import { CATEGORIAS_LIST, normalizeCategory } from './categories'
import type { Category, Pin } from './types'
import {
  ESTADOS_CONSTRUCCION,
  MATERIALES,
  USOS_ESPECIFICOS,
  USOS_GENERALES,
  parsePoblacionRango,
} from './urban-options'

export const CARACAS_TIME_ZONE = 'America/Caracas'

export interface DashboardFilters {
  dateFrom: string
  dateTo: string
  category: Category | ''
  generalUse: string
  specificUse: string
  constructionStatus: string
  material: string
  floors: string
}

export const EMPTY_DASHBOARD_FILTERS: DashboardFilters = {
  dateFrom: '',
  dateTo: '',
  category: '',
  generalUse: '',
  specificUse: '',
  constructionStatus: '',
  material: '',
  floors: '',
}

export interface CoverageMetric {
  value: number
  covered: number
  total: number
}

export interface DistributionEntry {
  key: string
  label: string
  value: number
  color?: string
}

export interface Distribution {
  entries: DistributionEntry[]
  covered: number
  total: number
}

export interface TimeSeriesEntry {
  key: string
  value: number
  slot: number
}

export interface TimeSeries {
  entries: TimeSeriesEntry[]
  granularity: 'day' | 'month'
  intervalCount: number
  covered: number
  total: number
  includesEmptyIntervals: boolean
}

export interface DashboardAnalytics {
  totalLocal: number
  totalFiltered: number
  normalizedPins: NormalizedDashboardPin[]
  metrics: {
    estimatedPopulation: CoverageMetric
    parcelHectares: CoverageMetric
    parcelSquareMeters: CoverageMetric
    blockSquareMeters: CoverageMetric
    provisionalDrainageAverage: CoverageMetric
  }
  distributions: {
    category: Distribution
    generalUse: Distribution
    specificUse: Distribution
    populationRange: Distribution
    constructionStatus: Distribution
    material: Distribution
    floors: Distribution
  }
  timeSeries: TimeSeries
  filterOptions: {
    dateMin: string
    dateMax: string
    specificUses: string[]
    floors: number[]
  }
  quality: {
    invalidTimestampCount: number
    invalidDrainageCount: number
    legacyPopulationCount: number
    hasPartialData: boolean
  }
}

export interface NormalizedDashboardPin {
  id: string
  dateKey: string | null
  category: Category
  generalUse: string | null
  specificUse: string | null
  constructionStatus: string | null
  material: string | null
  floors: number | null
  population: number | null
  populationRange: string | null
  populationSource: 'average' | 'legacy' | null
  parcelHectares: number | null
  parcelSquareMeters: number | null
  blockSquareMeters: number | null
  provisionalDrainage: number | null
  hasDrainageValue: boolean
}

const caracasDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CARACAS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAILY_INTERVALS = 62
const MAX_FILLED_MONTHS = 240

function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function normalizeCaracasDate(value: unknown): string | null {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    !(value instanceof Date)
  ) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return null

  const parts = caracasDateFormatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return year && month && day ? `${year}-${month}-${day}` : null
}

// This is the only adapter that assumes drainage is a percentage.
export function parseProvisionalDrainage(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
  }
  if (typeof value !== 'string') return null

  const match = /^\s*(\d+(?:\.\d+)?)\s*%?\s*$/.exec(value)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null
}

function normalizeNonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function normalizeFloors(value: unknown): number | null {
  const parsed = normalizeNonNegativeNumber(value)
  return parsed !== null && Number.isInteger(parsed) ? parsed : null
}

function normalizeCatalogValue(
  value: unknown,
  options: readonly { readonly value: string }[],
): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return options.some((option) => option.value === normalized) ? normalized : null
}

function hasSuppliedValue(value: unknown): boolean {
  return value !== undefined && value !== null && (typeof value !== 'string' || value.trim() !== '')
}

export function normalizeDashboardPin(pin: Pin): NormalizedDashboardPin {
  const averagePopulation = normalizeNonNegativeNumber(pin.poblacionPromedio)
  const legacyPopulation = normalizeNonNegativeNumber(pin.poblacion)
  const parsedRange =
    typeof pin.poblacionRango === 'string' ? parsePoblacionRango(pin.poblacionRango) : null
  const rawDrainage: unknown = pin.drenaje

  return {
    id: pin.id,
    dateKey: normalizeCaracasDate(pin.creadoEn),
    category: normalizeCategory(pin.categoria),
    generalUse: normalizeCatalogValue(pin.usoGeneral, USOS_GENERALES),
    specificUse: normalizeCatalogValue(pin.usoEspecifico, USOS_ESPECIFICOS),
    constructionStatus: normalizeCatalogValue(pin.estadoConstruccion, ESTADOS_CONSTRUCCION),
    material: normalizeCatalogValue(pin.material, MATERIALES),
    floors: normalizeFloors(pin.pisosConstruccion),
    population: averagePopulation ?? legacyPopulation,
    populationRange: parsedRange?.rango ?? null,
    populationSource:
      averagePopulation !== null ? 'average' : legacyPopulation !== null ? 'legacy' : null,
    parcelHectares: normalizeNonNegativeNumber(pin.hectareasParcela),
    parcelSquareMeters: normalizeNonNegativeNumber(pin.metrosCuadradosParcela),
    blockSquareMeters: normalizeNonNegativeNumber(pin.metrosCuadradosManzana),
    provisionalDrainage: parseProvisionalDrainage(rawDrainage),
    hasDrainageValue: hasSuppliedValue(rawDrainage),
  }
}

function matchesFilters(pin: NormalizedDashboardPin, filters: DashboardFilters): boolean {
  if (filters.dateFrom && (!pin.dateKey || pin.dateKey < filters.dateFrom)) return false
  if (filters.dateTo && (!pin.dateKey || pin.dateKey > filters.dateTo)) return false
  if (filters.category && pin.category !== filters.category) return false
  if (filters.generalUse && pin.generalUse !== filters.generalUse) return false
  if (filters.specificUse && pin.specificUse !== filters.specificUse) return false
  if (filters.constructionStatus && pin.constructionStatus !== filters.constructionStatus) {
    return false
  }
  if (filters.material && pin.material !== filters.material) return false
  if (filters.floors && String(pin.floors) !== filters.floors) return false
  return true
}

function aggregateValues(
  pins: NormalizedDashboardPin[],
  getValue: (pin: NormalizedDashboardPin) => number | null,
  mode: 'sum' | 'average' = 'sum',
): CoverageMetric {
  const values = pins.map(getValue).filter((value): value is number => value !== null)
  const sum = values.reduce((total, value) => total + value, 0)
  return {
    value: mode === 'average' && values.length > 0 ? sum / values.length : sum,
    covered: values.length,
    total: pins.length,
  }
}

function catalogDistribution(
  pins: NormalizedDashboardPin[],
  getValue: (pin: NormalizedDashboardPin) => string | null,
  options: readonly { readonly value: string; readonly label: string }[],
): Distribution {
  const counts = new Map<string, number>()
  let covered = 0

  for (const pin of pins) {
    const value = getValue(pin)
    if (!value) continue
    covered += 1
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return {
    entries: options
      .map((option) => ({
        key: option.value,
        label: option.label,
        value: counts.get(option.value) ?? 0,
      }))
      .filter((entry) => entry.value > 0),
    covered,
    total: pins.length,
  }
}

function categoryDistribution(pins: NormalizedDashboardPin[]): Distribution {
  const counts = new Map<Category, number>()
  for (const pin of pins) {
    counts.set(pin.category, (counts.get(pin.category) ?? 0) + 1)
  }

  return {
    entries: CATEGORIAS_LIST.map((category) => ({
      key: category.value,
      label: category.label,
      value: counts.get(category.value) ?? 0,
      color: category.color,
    })).filter((entry) => entry.value > 0),
    covered: pins.length,
    total: pins.length,
  }
}

function populationRangeDistribution(pins: NormalizedDashboardPin[]): Distribution {
  const counts = new Map<string, number>()
  let covered = 0
  for (const pin of pins) {
    if (!pin.populationRange) continue
    covered += 1
    counts.set(pin.populationRange, (counts.get(pin.populationRange) ?? 0) + 1)
  }

  return {
    entries: [...counts.entries()]
      .sort(([left], [right]) => Number(left.split('-')[0]) - Number(right.split('-')[0]))
      .map(([key, value]) => ({ key, label: key, value })),
    covered,
    total: pins.length,
  }
}

function floorsDistribution(pins: NormalizedDashboardPin[]): Distribution {
  const counts = new Map<number, number>()
  let covered = 0
  for (const pin of pins) {
    if (pin.floors === null) continue
    covered += 1
    counts.set(pin.floors, (counts.get(pin.floors) ?? 0) + 1)
  }

  return {
    entries: [...counts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([key, value]) => ({
        key: String(key),
        label: `${key} ${key === 1 ? 'piso' : 'pisos'}`,
        value,
      })),
    covered,
    total: pins.length,
  }
}

function dateKeyToDayNumber(key: string): number {
  const [year, month, day] = key.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

function addDays(key: string, amount: number): string {
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + amount))
  return date.toISOString().slice(0, 10)
}

function monthDistance(start: string, end: string): number {
  const [startYear, startMonth] = start.split('-').map(Number)
  const [endYear, endMonth] = end.split('-').map(Number)
  return (endYear - startYear) * 12 + endMonth - startMonth
}

function addMonths(key: string, amount: number): string {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + amount, 1))
  return date.toISOString().slice(0, 7)
}

function buildTimeSeries(
  pins: NormalizedDashboardPin[],
  filters: DashboardFilters,
): TimeSeries {
  const datedPins = pins.filter(
    (pin): pin is NormalizedDashboardPin & { dateKey: string } => pin.dateKey !== null,
  )
  const dateKeys = datedPins.map((pin) => pin.dateKey).sort()

  if (dateKeys.length === 0) {
    return {
      entries: [],
      granularity: 'day',
      intervalCount: 0,
      covered: 0,
      total: pins.length,
      includesEmptyIntervals: true,
    }
  }

  const filterStart = isValidDateKey(filters.dateFrom) ? filters.dateFrom : ''
  const filterEnd = isValidDateKey(filters.dateTo) ? filters.dateTo : ''
  const start = filterStart || dateKeys[0]
  const end = filterEnd || dateKeys[dateKeys.length - 1]

  if (start > end) {
    return {
      entries: [],
      granularity: 'day',
      intervalCount: 0,
      covered: datedPins.length,
      total: pins.length,
      includesEmptyIntervals: true,
    }
  }

  const daySpan = dateKeyToDayNumber(end) - dateKeyToDayNumber(start) + 1
  const granularity = daySpan <= MAX_DAILY_INTERVALS ? 'day' : 'month'
  const counts = new Map<string, number>()

  for (const pin of datedPins) {
    const period = granularity === 'day' ? pin.dateKey : pin.dateKey.slice(0, 7)
    counts.set(period, (counts.get(period) ?? 0) + 1)
  }

  if (granularity === 'day') {
    return {
      entries: Array.from({ length: daySpan }, (_, index) => {
        const key = addDays(start, index)
        return { key, value: counts.get(key) ?? 0, slot: index }
      }),
      granularity,
      intervalCount: daySpan,
      covered: datedPins.length,
      total: pins.length,
      includesEmptyIntervals: true,
    }
  }

  const startMonth = start.slice(0, 7)
  const endMonth = end.slice(0, 7)
  const monthSpan = monthDistance(startMonth, endMonth) + 1
  const includesEmptyIntervals = monthSpan <= MAX_FILLED_MONTHS
  const periods = includesEmptyIntervals
    ? Array.from({ length: monthSpan }, (_, index) => addMonths(startMonth, index))
    : [...counts.keys()].sort()

  return {
    entries: periods.map((key) => ({
      key,
      value: counts.get(key) ?? 0,
      slot: monthDistance(startMonth, key),
    })),
    granularity,
    intervalCount: monthSpan,
    covered: datedPins.length,
    total: pins.length,
    includesEmptyIntervals,
  }
}

function getFilterOptions(
  pins: NormalizedDashboardPin[],
  selectedGeneralUse: string,
): DashboardAnalytics['filterOptions'] {
  const dateKeys = pins
    .map((pin) => pin.dateKey)
    .filter((value): value is string => value !== null)
    .sort()
  const eligibleSpecificUses = pins.filter(
    (pin) => !selectedGeneralUse || pin.generalUse === selectedGeneralUse,
  )
  const specificUseSet = new Set(
    eligibleSpecificUses
      .map((pin) => pin.specificUse)
      .filter((value): value is string => value !== null),
  )
  const floors = [
    ...new Set(
      pins.map((pin) => pin.floors).filter((value): value is number => value !== null),
    ),
  ].sort((left, right) => left - right)

  return {
    dateMin: dateKeys[0] ?? '',
    dateMax: dateKeys[dateKeys.length - 1] ?? '',
    specificUses: USOS_ESPECIFICOS.filter((option) => specificUseSet.has(option.value)).map(
      (option) => option.value,
    ),
    floors,
  }
}

export function analyzeDashboardPins(
  pins: Pin[],
  filters: DashboardFilters,
): DashboardAnalytics {
  const allNormalizedPins = pins.map(normalizeDashboardPin)
  const normalizedPins = allNormalizedPins.filter((pin) => matchesFilters(pin, filters))
  const metrics = {
    estimatedPopulation: aggregateValues(normalizedPins, (pin) => pin.population),
    parcelHectares: aggregateValues(normalizedPins, (pin) => pin.parcelHectares),
    parcelSquareMeters: aggregateValues(normalizedPins, (pin) => pin.parcelSquareMeters),
    blockSquareMeters: aggregateValues(normalizedPins, (pin) => pin.blockSquareMeters),
    provisionalDrainageAverage: aggregateValues(
      normalizedPins,
      (pin) => pin.provisionalDrainage,
      'average',
    ),
  }
  const distributions = {
    category: categoryDistribution(normalizedPins),
    generalUse: catalogDistribution(normalizedPins, (pin) => pin.generalUse, USOS_GENERALES),
    specificUse: catalogDistribution(
      normalizedPins,
      (pin) => pin.specificUse,
      USOS_ESPECIFICOS,
    ),
    populationRange: populationRangeDistribution(normalizedPins),
    constructionStatus: catalogDistribution(
      normalizedPins,
      (pin) => pin.constructionStatus,
      ESTADOS_CONSTRUCCION,
    ),
    material: catalogDistribution(normalizedPins, (pin) => pin.material, MATERIALES),
    floors: floorsDistribution(normalizedPins),
  }
  const coverageValues = [
    ...Object.values(metrics),
    distributions.generalUse,
    distributions.specificUse,
    distributions.populationRange,
    distributions.constructionStatus,
    distributions.material,
    distributions.floors,
  ]

  return {
    totalLocal: pins.length,
    totalFiltered: normalizedPins.length,
    normalizedPins,
    metrics,
    distributions,
    timeSeries: buildTimeSeries(normalizedPins, filters),
    filterOptions: getFilterOptions(allNormalizedPins, filters.generalUse),
    quality: {
      invalidTimestampCount: allNormalizedPins.filter((pin) => pin.dateKey === null).length,
      invalidDrainageCount: normalizedPins.filter(
        (pin) => pin.hasDrainageValue && pin.provisionalDrainage === null,
      ).length,
      legacyPopulationCount: normalizedPins.filter(
        (pin) => pin.populationSource === 'legacy',
      ).length,
      hasPartialData:
        normalizedPins.length > 0 &&
        coverageValues.some((metric) => metric.covered < metric.total),
    },
  }
}

export function hasActiveDashboardFilters(filters: DashboardFilters): boolean {
  return Object.values(filters).some(Boolean)
}
