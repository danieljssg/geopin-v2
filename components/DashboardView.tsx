'use client'

import { liveQuery } from 'dexie'
import Link from 'next/link'
import { useDeferredValue, useEffect, useId, useState, type ReactNode } from 'react'
import AppNavigation from '@/components/AppNavigation'
import { CATEGORIAS_LIST } from '@/lib/categories'
import {
  EMPTY_DASHBOARD_FILTERS,
  analyzeDashboardPins,
  hasActiveDashboardFilters,
  type CoverageMetric,
  type DashboardFilters,
  type Distribution,
  type TimeSeries,
} from '@/lib/dashboard-analytics'
import { getAllPins } from '@/lib/db'
import type { Pin } from '@/lib/types'
import {
  ESTADOS_CONSTRUCCION,
  MATERIALES,
  USOS_ESPECIFICOS,
  USOS_GENERALES,
} from '@/lib/urban-options'
import styles from './DashboardView.module.css'

type LocalPinsState =
  | { status: 'loading'; pins: Pin[] }
  | { status: 'ready'; pins: Pin[] }
  | { status: 'error'; pins: Pin[] }

const numberFormatter = new Intl.NumberFormat('es-VE', {
  maximumFractionDigits: 2,
})
const integerFormatter = new Intl.NumberFormat('es-VE', {
  maximumFractionDigits: 0,
})
const monthFormatter = new Intl.DateTimeFormat('es-VE', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const controlClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500'
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700'

function useLocalPins(): [LocalPinsState, () => void] {
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<LocalPinsState>({ status: 'loading', pins: [] })

  useEffect(() => {
    let active = true
    setState({ status: 'loading', pins: [] })

    const subscription = liveQuery(() => getAllPins()).subscribe({
      next: (pins) => {
        if (active) setState({ status: 'ready', pins })
      },
      error: () => {
        if (active) setState({ status: 'error', pins: [] })
      },
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [revision])

  return [state, () => setRevision((current) => current + 1)]
}

function formatPeriod(key: string, granularity: TimeSeries['granularity']): string {
  if (granularity === 'month') {
    return monthFormatter.format(new Date(`${key}-15T12:00:00Z`))
  }
  const [year, month, day] = key.split('-')
  return `${day}/${month}/${year}`
}

function formatCoveredMetric(metric: CoverageMetric, unit: string): string {
  return metric.covered > 0 ? `${numberFormatter.format(metric.value)} ${unit}` : 'Sin datos'
}

function Coverage({ covered, total }: { covered: number; total: number }) {
  return (
    <span className="text-xs font-medium text-slate-500">
      Cobertura {integerFormatter.format(covered)}/{integerFormatter.format(total)}
    </span>
  )
}

function MetricCard({
  label,
  value,
  coverage,
  note,
}: {
  label: string
  value: string
  coverage: ReactNode
  note?: string
}) {
  return (
    <article className="flex min-h-40 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div>
        <h3 className="max-w-[22ch] text-sm font-semibold leading-snug text-slate-600">{label}</h3>
        <p className={`${styles.metricValue} mt-3 wrap-break-word text-2xl font-bold text-[#173553] sm:text-3xl`}>
          {value}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-1">
        {coverage}
        {note && <p className="text-xs leading-relaxed text-slate-500">{note}</p>}
      </div>
    </article>
  )
}

function DistributionPanel({
  title,
  distribution,
  defaultColor = '#2563eb',
}: {
  title: string
  distribution: Distribution
  defaultColor?: string
}) {
  const titleId = useId()
  const maximum = Math.max(0, ...distribution.entries.map((entry) => entry.value))

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby={titleId}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-2">
        <h3 id={titleId} className="text-base font-bold text-slate-900">
          {title}
        </h3>
        <Coverage covered={distribution.covered} total={distribution.total} />
      </div>

      {distribution.entries.length === 0 ? (
        <p className="text-sm leading-relaxed text-slate-600">No hay valores registrados para esta variable.</p>
      ) : (
        <ol className="space-y-3">
          {distribution.entries.map((entry) => (
            <li key={entry.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium text-slate-700">{entry.label}</span>
                <span className="font-bold tabular-nums text-slate-900">
                  {integerFormatter.format(entry.value)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-sm bg-slate-100" aria-hidden="true">
                <div
                  className={`${styles.barFill} h-full rounded-sm`}
                  style={{
                    width: maximum > 0 ? `${(entry.value / maximum) * 100}%` : '0%',
                    backgroundColor: entry.color ?? defaultColor,
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function TimeSeriesPanel({ series }: { series: TimeSeries }) {
  const chartWidth = 920
  const chartHeight = 250
  const horizontalPadding = 44
  const verticalPadding = 28
  const maximum = Math.max(1, ...series.entries.map((entry) => entry.value))
  const yTicks = [...new Set([0, Math.round(maximum / 2), maximum])]
  const points = series.entries.map((entry) => {
    const x =
      horizontalPadding +
      (entry.slot / Math.max(series.intervalCount - 1, 1)) *
        (chartWidth - horizontalPadding * 2)
    const y =
      chartHeight -
      verticalPadding -
      (entry.value / maximum) * (chartHeight - verticalPadding * 2)
    return { ...entry, x, y }
  })
  const segments = points.reduce<(typeof points)[]>((result, point, index) => {
    const previousPoint = points[index - 1]
    if (!previousPoint || point.slot !== previousPoint.slot + 1) {
      result.push([point])
    } else {
      result[result.length - 1].push(point)
    }
    return result
  }, [])
  const isolatedPointKeys = new Set(
    segments.filter((segment) => segment.length === 1).map((segment) => segment[0].key),
  )
  const tickIndexes = [0, Math.floor((series.entries.length - 1) / 2), series.entries.length - 1]
    .filter((value, index, values) => value >= 0 && values.indexOf(value) === index)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="time-series-title">
      <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="time-series-title" className="text-lg font-bold text-slate-950">
            Altas de pines en el tiempo
          </h2>
          <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-slate-600">
            Agrupación {series.granularity === 'day' ? 'diaria' : 'mensual'} según la amplitud del intervalo,
            con cortes en America/Caracas.
          </p>
        </div>
        <Coverage covered={series.covered} total={series.total} />
      </div>

      {series.entries.length === 0 ? (
        <div className="py-10 text-center">
          <p className="font-semibold text-slate-800">No hay fechas válidas para construir la serie.</p>
          <p className="mt-1 text-sm text-slate-600">Los otros indicadores conservan los registros aprovechables.</p>
        </div>
      ) : series.entries.length === 1 ? (
        <div className="py-8">
          <p className="text-sm font-semibold text-slate-600">
            {formatPeriod(series.entries[0].key, series.granularity)}
          </p>
          <p className={`${styles.metricValue} mt-2 text-4xl font-bold text-[#173553]`}>
            {integerFormatter.format(series.entries[0].value)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Valor absoluto del período. Un único período no permite afirmar una tendencia.
          </p>
        </div>
      ) : (
        <figure className="mt-5">
          <div className="overflow-x-auto pb-2">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="min-w-2xl"
              aria-hidden="true"
            >
              {yTicks.map((value) => {
                const ratio = value / maximum
                const y = chartHeight - verticalPadding - ratio * (chartHeight - verticalPadding * 2)
                return (
                  <g key={value}>
                    <line
                      x1={horizontalPadding}
                      x2={chartWidth - horizontalPadding}
                      y1={y}
                      y2={y}
                      stroke="#d9e2ec"
                      strokeWidth="1"
                      className={styles.chartLine}
                    />
                    <text x={horizontalPadding - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#52647a">
                      {integerFormatter.format(value)}
                    </text>
                  </g>
                )
              })}
              {segments.map((segment) =>
                segment.length > 1 ? (
                  <polyline
                    key={segment[0].key}
                    points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
                    fill="none"
                    stroke="#1d4ed8"
                    strokeWidth="3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    className={styles.chartLine}
                  />
                ) : null,
              )}
              {points
                .filter((point) => points.length <= 62 || isolatedPointKeys.has(point.key))
                .map((point) => (
                  <circle
                    key={point.key}
                    cx={point.x}
                    cy={point.y}
                    r="3.5"
                    fill="#ffffff"
                    stroke="#1d4ed8"
                    strokeWidth="2"
                    className={styles.chartLine}
                  />
                ))}
              {tickIndexes.map((index) => {
                const point = points[index]
                return (
                  <text
                    key={point.key}
                    x={point.x}
                    y={chartHeight - 5}
                    textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
                    fontSize="11"
                    fill="#52647a"
                  >
                    {formatPeriod(point.key, series.granularity)}
                  </text>
                )
              })}
            </svg>
          </div>
          <figcaption className="mt-2 text-xs leading-relaxed text-slate-500">
            Cada punto representa pines creados en el período indicado.
            {!series.includesEmptyIntervals &&
              ' Por la amplitud del rango, se omiten los meses sin altas; la distancia temporal se conserva, la línea se interrumpe entre períodos no consecutivos y la tabla identifica los períodos incluidos.'}
          </figcaption>
        </figure>
      )}

      {series.entries.length > 0 && (
        <details className="mt-5 border-t border-slate-200 pt-4">
          <summary className="min-h-11 cursor-pointer rounded-md py-2 text-sm font-semibold text-blue-800">
            Ver datos equivalentes de la serie ({integerFormatter.format(series.entries.length)} períodos)
          </summary>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="sr-only">Cantidad de pines dados de alta por período</caption>
              <thead className="sticky top-0 bg-slate-100 text-slate-700">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Período</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Pines</th>
                </tr>
              </thead>
              <tbody>
                {series.entries.map((entry) => (
                  <tr key={entry.key} className="border-t border-slate-200">
                    <th scope="row" className="px-3 py-2 font-medium text-slate-700">
                      {formatPeriod(entry.key, series.granularity)}
                    </th>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                      {integerFormatter.format(entry.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  )
}

function DashboardHeader() {
  return (
    <header className="bg-[#1e3a5f] text-white">
      <div className="mx-auto flex max-w-375 items-center gap-3 px-3 py-3 sm:px-6">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#60a5fa"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <div>
          <p className="text-base font-bold leading-none tracking-tight">GeoPin</p>
          <p className="mt-0.5 hidden text-xs leading-none text-blue-200 sm:block">
            Sistema de marcado de establecimientos
          </p>
        </div>
        <AppNavigation active="dashboard" />
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto grid max-w-375 gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-blue-200">Lectura territorial local</p>
            <h1 className="mt-2 max-w-[18ch] text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Tablero urbanístico
            </h1>
            <p className="mt-3 max-w-[70ch] text-sm leading-6 text-blue-100 sm:text-base">
              Análisis demográfico y constructivo de los pines registrados en este navegador, sin datos externos ni sincronización.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-blue-300/30 bg-slate-950/20 px-3 py-2 text-sm font-semibold text-blue-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M7 8h10M7 12h5" />
            </svg>
            Sólo este dispositivo
          </div>
        </div>
      </div>
    </header>
  )
}

function LoadingState() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-375 px-4 py-8 sm:px-6">
      <span className="sr-only">Cargando pines locales para el análisis.</span>
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className={`${styles.skeleton} h-96 rounded-xl`} />
        <div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className={`${styles.skeleton} h-40 rounded-xl`} />
            ))}
          </div>
          <div className={`${styles.skeleton} mt-6 h-72 rounded-xl`} />
        </div>
      </div>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <section role="alert" className="rounded-xl border border-red-200 bg-white p-6 sm:p-8">
        <p className="text-sm font-bold text-red-700">IndexedDB no está disponible</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">No pudimos leer los pines locales</h2>
        <p className="mt-3 max-w-[65ch] text-sm leading-6 text-slate-600">
          La consulta falló en este navegador. Ningún pin fue modificado. Verifica los permisos de almacenamiento e intenta nuevamente.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
        >
          Reintentar lectura
        </button>
      </section>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-10">
        <p className="text-sm font-bold text-blue-700">Base local vacía</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Todavía no hay pines para analizar</h2>
        <p className="mt-3 max-w-[65ch] text-sm leading-6 text-slate-600">
          El dashboard usa exclusivamente los registros guardados en este dispositivo. Crea un pin en el mapa y aparecerá aquí automáticamente.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
        >
          Ir al mapa
        </Link>
      </section>
    </div>
  )
}

export default function DashboardView() {
  const [localPinsState, retry] = useLocalPins()
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_DASHBOARD_FILTERS)
  const deferredFilters = useDeferredValue(filters)
  const idPrefix = useId()
  const analytics = analyzeDashboardPins(localPinsState.pins, deferredFilters)
  const filtersActive = hasActiveDashboardFilters(filters)
  const isUpdating = filters !== deferredFilters
  const specificUseOptions = USOS_ESPECIFICOS.filter((option) =>
    analytics.filterOptions.specificUses.includes(option.value),
  )

  function setFilter<Key extends keyof DashboardFilters>(key: Key, value: DashboardFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }))
  }

  function setDateFrom(value: string) {
    setFilters((current) => ({
      ...current,
      dateFrom: value,
      dateTo: value && current.dateTo && value > current.dateTo ? value : current.dateTo,
    }))
  }

  function setDateTo(value: string) {
    setFilters((current) => ({
      ...current,
      dateTo: value,
      dateFrom: value && current.dateFrom && value < current.dateFrom ? value : current.dateFrom,
    }))
  }

  return (
    <div className={styles.dashboard}>
      <a
        href="#dashboard-content"
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-md bg-white px-4 py-2 text-sm font-bold text-[#1e3a5f] shadow-lg focus:translate-y-0"
      >
        Saltar al contenido
      </a>
      <DashboardHeader />

      <main id="dashboard-content" tabIndex={-1}>
        {localPinsState.status === 'loading' && <LoadingState />}
        {localPinsState.status === 'error' && <ErrorState onRetry={retry} />}
        {localPinsState.status === 'ready' && localPinsState.pins.length === 0 && <EmptyState />}

        {localPinsState.status === 'ready' && localPinsState.pins.length > 0 && (
          <div className="mx-auto max-w-375 px-4 py-6 sm:px-6 sm:py-8">
            <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-6" aria-labelledby={`${idPrefix}-filters-title`}>
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <h2 id={`${idPrefix}-filters-title`} className="text-lg font-bold text-slate-950">
                      Filtros
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">Todos se aplican en conjunto.</p>
                  </div>
                  {filtersActive && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-800">
                      {Object.values(filters).filter(Boolean).length} activos
                    </span>
                  )}
                </div>

                <div className="mt-5 space-y-4">
                  <fieldset>
                    <legend className="mb-2 text-sm font-bold text-slate-800">Fecha de registro</legend>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor={`${idPrefix}-date-from`} className={labelClass}>Desde</label>
                        <input
                          id={`${idPrefix}-date-from`}
                          type="date"
                          value={filters.dateFrom}
                          min={analytics.filterOptions.dateMin || undefined}
                          max={filters.dateTo || analytics.filterOptions.dateMax || undefined}
                          disabled={!analytics.filterOptions.dateMin}
                          onChange={(event) => setDateFrom(event.target.value)}
                          className={controlClass}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${idPrefix}-date-to`} className={labelClass}>Hasta</label>
                        <input
                          id={`${idPrefix}-date-to`}
                          type="date"
                          value={filters.dateTo}
                          min={filters.dateFrom || analytics.filterOptions.dateMin || undefined}
                          max={analytics.filterOptions.dateMax || undefined}
                          disabled={!analytics.filterOptions.dateMax}
                          onChange={(event) => setDateTo(event.target.value)}
                          className={controlClass}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">Zona horaria: America/Caracas.</p>
                  </fieldset>

                  <div>
                    <label htmlFor={`${idPrefix}-category`} className={labelClass}>Categoría</label>
                    <select
                      id={`${idPrefix}-category`}
                      value={filters.category}
                      onChange={(event) => setFilter('category', event.target.value as DashboardFilters['category'])}
                      className={controlClass}
                    >
                      <option value="">Todas</option>
                      {CATEGORIAS_LIST.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor={`${idPrefix}-general-use`} className={labelClass}>Uso general</label>
                    <select
                      id={`${idPrefix}-general-use`}
                      value={filters.generalUse}
                      onChange={(event) =>
                        setFilters((current) => ({
                          ...current,
                          generalUse: event.target.value,
                          specificUse: '',
                        }))
                      }
                      className={controlClass}
                    >
                      <option value="">Todos</option>
                      {USOS_GENERALES.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor={`${idPrefix}-specific-use`} className={labelClass}>Uso específico</label>
                    <select
                      id={`${idPrefix}-specific-use`}
                      value={filters.specificUse}
                      onChange={(event) => setFilter('specificUse', event.target.value)}
                      disabled={specificUseOptions.length === 0}
                      className={controlClass}
                    >
                      <option value="">
                        {specificUseOptions.length === 0 ? 'Sin datos disponibles' : 'Todos'}
                      </option>
                      {specificUseOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                      Opciones presentes en los pines{filters.generalUse ? ' del uso general elegido' : ''}.
                    </p>
                  </div>

                  <fieldset className="space-y-4 border-t border-slate-200 pt-4">
                    <legend className="px-1 text-sm font-bold text-slate-800">Construcción</legend>
                    <div>
                      <label htmlFor={`${idPrefix}-status`} className={labelClass}>Estado</label>
                      <select
                        id={`${idPrefix}-status`}
                        value={filters.constructionStatus}
                        onChange={(event) => setFilter('constructionStatus', event.target.value)}
                        className={controlClass}
                      >
                        <option value="">Todos</option>
                        {ESTADOS_CONSTRUCCION.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`${idPrefix}-material`} className={labelClass}>Material</label>
                      <select
                        id={`${idPrefix}-material`}
                        value={filters.material}
                        onChange={(event) => setFilter('material', event.target.value)}
                        className={controlClass}
                      >
                        <option value="">Todos</option>
                        {MATERIALES.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`${idPrefix}-floors`} className={labelClass}>Pisos</label>
                      <select
                        id={`${idPrefix}-floors`}
                        value={filters.floors}
                        onChange={(event) => setFilter('floors', event.target.value)}
                        disabled={analytics.filterOptions.floors.length === 0}
                        className={controlClass}
                      >
                        <option value="">
                          {analytics.filterOptions.floors.length === 0 ? 'Sin datos disponibles' : 'Todos'}
                        </option>
                        {analytics.filterOptions.floors.map((value) => (
                          <option key={value} value={value}>
                            {value} {value === 1 ? 'piso' : 'pisos'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </fieldset>
                </div>

                <button
                  type="button"
                  disabled={!filtersActive}
                  onClick={() => setFilters(EMPTY_DASHBOARD_FILTERS)}
                  className="mt-5 min-h-11 w-full rounded-lg border border-blue-700 px-4 py-2 text-sm font-bold text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent"
                >
                  Restablecer filtros
                </button>

                <div className="mt-5 border-t border-slate-200 pt-4" aria-live="polite" aria-atomic="true">
                  <p className="text-sm font-bold text-slate-900">
                    {integerFormatter.format(analytics.totalFiltered)} de {integerFormatter.format(analytics.totalLocal)} pines
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {isUpdating ? 'Actualizando lectura…' : 'Resultado del filtro actual.'}
                  </p>
                </div>
              </aside>

              <div className="min-w-0 space-y-6" aria-busy={isUpdating}>
                {analytics.totalFiltered === 0 ? (
                  <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
                    <p className="text-sm font-bold text-blue-700">Sin coincidencias</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-950">Ningún pin cumple todos los filtros</h2>
                    <p className="mt-3 max-w-[65ch] text-sm leading-6 text-slate-600">
                      Los filtros se combinan de forma conjuntiva. Restablece los filtros o amplía el rango para recuperar registros.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilters(EMPTY_DASHBOARD_FILTERS)}
                      className="mt-5 min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
                    >
                      Restablecer filtros
                    </button>
                  </section>
                ) : (
                  <>
                    {analytics.totalFiltered === 1 && (
                      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Lectura individual">
                        <p className="text-sm leading-6 text-blue-950">
                          <strong>Lectura individual:</strong> el filtro devuelve un único pin. Se muestran valores absolutos y no se infiere ninguna tendencia.
                        </p>
                      </section>
                    )}

                    <section aria-labelledby="summary-title">
                      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <h2 id="summary-title" className="text-xl font-bold text-slate-950">Resumen territorial</h2>
                          <p className="mt-1 text-sm text-slate-600">Ausencias e inválidos nunca se convierten en cero.</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-600">
                          {integerFormatter.format(analytics.totalFiltered)} filtrados / {integerFormatter.format(analytics.totalLocal)} locales
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <MetricCard
                          label="Pines analizados"
                          value={integerFormatter.format(analytics.totalFiltered)}
                          coverage={<span className="text-xs font-medium text-slate-500">Total local {integerFormatter.format(analytics.totalLocal)}</span>}
                        />
                        <MetricCard
                          label="Población estimada"
                          value={formatCoveredMetric(analytics.metrics.estimatedPopulation, 'personas')}
                          coverage={<Coverage {...analytics.metrics.estimatedPopulation} />}
                          note="Prioriza el promedio guardado; usa el valor legacy sólo cuando es numérico válido."
                        />
                        <MetricCard
                          label="Superficie de parcelas en hectáreas"
                          value={formatCoveredMetric(analytics.metrics.parcelHectares, 'ha')}
                          coverage={<Coverage {...analytics.metrics.parcelHectares} />}
                        />
                        <MetricCard
                          label="Superficie de parcelas en metros cuadrados"
                          value={formatCoveredMetric(analytics.metrics.parcelSquareMeters, 'm²')}
                          coverage={<Coverage {...analytics.metrics.parcelSquareMeters} />}
                        />
                        <MetricCard
                          label="Superficie de manzanas en metros cuadrados"
                          value={formatCoveredMetric(analytics.metrics.blockSquareMeters, 'm²')}
                          coverage={<Coverage {...analytics.metrics.blockSquareMeters} />}
                        />
                        <MetricCard
                          label="Drenaje promedio"
                          value={
                            analytics.metrics.provisionalDrainageAverage.covered > 0
                              ? `${numberFormatter.format(analytics.metrics.provisionalDrainageAverage.value)} %`
                              : 'Sin datos'
                          }
                          coverage={<Coverage {...analytics.metrics.provisionalDrainageAverage} />}
                          note="Interpretación provisional como porcentaje (0–100)."
                        />
                      </div>
                    </section>

                    {(analytics.quality.hasPartialData ||
                      analytics.quality.invalidTimestampCount > 0 ||
                      analytics.quality.invalidDrainageCount > 0 ||
                      analytics.quality.legacyPopulationCount > 0) && (
                      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5" aria-labelledby="quality-title">
                        <h2 id="quality-title" className="text-base font-bold text-amber-950">Calidad y cobertura de los datos</h2>
                        <p className="mt-2 max-w-[75ch] text-sm leading-6 text-amber-950">
                          Las coberturas n/N indican cuántos pines aportan un valor válido. Los campos ausentes o inválidos se excluyen de cada cálculo, no se asumen como cero.
                        </p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950">
                          {analytics.quality.invalidTimestampCount > 0 && (
                            <li>
                              {integerFormatter.format(analytics.quality.invalidTimestampCount)} pines locales tienen fecha inválida y no participan en la serie ni en filtros de fecha.
                            </li>
                          )}
                          {analytics.quality.invalidDrainageCount > 0 && (
                            <li>
                              {integerFormatter.format(analytics.quality.invalidDrainageCount)} valores de drenaje del resultado no cumplen el formato provisional 0–100.
                            </li>
                          )}
                          {analytics.quality.legacyPopulationCount > 0 && (
                            <li>
                              {integerFormatter.format(analytics.quality.legacyPopulationCount)} valores de población usan el campo legacy numérico.
                            </li>
                          )}
                          {analytics.quality.hasPartialData && (
                            <li>Hay variables urbanísticas sin completar; revisa la cobertura de cada indicador y gráfico.</li>
                          )}
                        </ul>
                      </section>
                    )}

                    <TimeSeriesPanel series={analytics.timeSeries} />

                    <section aria-labelledby="distributions-title">
                      <div className="mb-4">
                        <h2 id="distributions-title" className="text-xl font-bold text-slate-950">Composición de los registros</h2>
                        <p className="mt-1 max-w-[70ch] text-sm leading-6 text-slate-600">
                          Distribuciones absolutas del resultado filtrado. Cada lista acompaña visualmente a su barra y conserva el valor numérico.
                        </p>
                      </div>
                      <div className="grid gap-4 xl:grid-cols-2">
                        <DistributionPanel title="Categorías" distribution={analytics.distributions.category} />
                        <DistributionPanel title="Uso general" distribution={analytics.distributions.generalUse} defaultColor="#0369a1" />
                        <DistributionPanel title="Uso específico" distribution={analytics.distributions.specificUse} defaultColor="#0f766e" />
                        <DistributionPanel title="Población por rango" distribution={analytics.distributions.populationRange} defaultColor="#4d7c0f" />
                        <DistributionPanel title="Estado de construcción" distribution={analytics.distributions.constructionStatus} defaultColor="#b45309" />
                        <DistributionPanel title="Material" distribution={analytics.distributions.material} defaultColor="#7c3aed" />
                        <DistributionPanel title="Pisos" distribution={analytics.distributions.floors} defaultColor="#475569" />
                      </div>
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
