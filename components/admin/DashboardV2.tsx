'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { CoberturaServicio, DensidadCelda, EquipamientoResumen, ResumenLevantamiento } from '@/lib/domain/dashboard'
import type { ParcelaEstado } from '@/lib/domain/types'
import type { PuntoMapa } from './MapaCalor'

/**
 * Dashboard del levantamiento.
 *
 * Todo lo que muestra sale del servidor: el avance contra el total esperado,
 * la cobertura por servicio con su déficit, el equipamiento y el mapa con
 * capas. No lee nada del IndexedDB del dispositivo, así que el administrador
 * ve el estado real del operativo y no lo que tiene su navegador.
 */

const MapaCalor = dynamic(() => import('./MapaCalor'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center" style={{ background: '#f1f5f9' }}>
      <p className="text-sm text-slate-500 font-medium">Cargando mapa…</p>
    </div>
  ),
})

interface LevantamientoResumen {
  id: string
  nombre: string
  ciudad: string
  totalEsperado: number
}

/**
 * Pide los datos del dashboard.
 *
 * Fuera del componente: el efecto solo aplica el resultado.
 */
async function pedirDashboard(
  levantamientoId: string,
): Promise<{ datos?: DashboardData; error?: string }> {
  try {
    const url = levantamientoId
      ? `/api/dashboard?levantamientoId=${encodeURIComponent(levantamientoId)}`
      : '/api/dashboard'

    const respuesta = await fetch(url, { credentials: 'same-origin' })
    if (!respuesta.ok) return { error: `El servidor respondió ${respuesta.status}.` }

    return { datos: (await respuesta.json()) as DashboardData }
  } catch (caught) {
    return {
      error: caught instanceof Error ? caught.message : 'No se pudieron cargar los datos.',
    }
  }
}

interface DashboardData {
  levantamiento: LevantamientoResumen | null
  resumen: ResumenLevantamiento
  distribucion: Array<{ estado: ParcelaEstado; label: string; cantidad: number }>
  cobertura: CoberturaServicio[]
  equipamiento: EquipamientoResumen[]
  celdas: DensidadCelda[]
  puntos: PuntoMapa[]
}

export default function DashboardV2() {
  const [levantamientos, setLevantamientos] = useState<LevantamientoResumen[]>([])
  const [seleccionado, setSeleccionado] = useState<string>('')
  const [datos, setDatos] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  // El estado de carga se deriva de los datos: guardar la bandera en estado
  // obligaba a un setState dentro del efecto, que React 19 marca porque
  // provoca un render en cascada.
  const cargando = datos === null && error === null

  useEffect(() => {
    let vivo = true

    async function cargarLevantamientos() {
      try {
        const respuesta = await fetch('/api/levantamientos', { credentials: 'same-origin' })
        if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`)
        const { levantamientos: lista } = (await respuesta.json()) as {
          levantamientos: LevantamientoResumen[]
        }
        if (vivo) setLevantamientos(lista)
      } catch {
        // Sin campañas el dashboard igual funciona sobre todas las parcelas.
      }
    }

    void cargarLevantamientos()
    return () => {
      vivo = false
    }
  }, [])

  /**
   * El resultado se aplica en un `.then()`: un setState síncrono dentro del
   * efecto provoca un render en cascada, que es lo que marca React 19.
   */
  useEffect(() => {
    let vivo = true

    void pedirDashboard(seleccionado).then((resultado) => {
      if (!vivo) return
      if (resultado.datos) setDatos(resultado.datos)
      if (resultado.error) setError(resultado.error)
    })

    return () => {
      vivo = false
    }
  }, [seleccionado, recarga])

  const serviciosEnDeficit = useMemo(
    () => datos?.cobertura.filter((servicio) => servicio.enDeficit) ?? [],
    [datos],
  )

  const equipamientoSaturado = useMemo(
    () => datos?.equipamiento.filter((item) => item.saturado) ?? [],
    [datos],
  )

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="px-4 py-4 sm:px-6" style={{ background: '#1e3a5f' }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-white">Dashboard del levantamiento</h1>
            <p className="text-xs" style={{ color: '#93c5fd' }}>
              {datos?.levantamiento
                ? `${datos.levantamiento.nombre} — ${datos.levantamiento.ciudad}`
                : 'Todas las parcelas levantadas'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {levantamientos.length > 0 && (
              <select
                aria-label="Levantamiento"
                value={seleccionado}
                onChange={(event) => setSeleccionado(event.target.value)}
                className="rounded-md px-2 py-1.5 text-xs"
                style={{ background: '#ffffff', color: '#1e3a5f' }}
              >
                <option value="">Todas las parcelas</option>
                {levantamientos.map((levantamiento) => (
                  <option key={levantamiento.id} value={levantamiento.id}>
                    {levantamiento.nombre}
                  </option>
                ))}
              </select>
            )}
            <a href="/admin/esquema" className="text-xs text-white underline">
              Esquemas
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
        {cargando && <p className="text-sm text-slate-500">Cargando datos…</p>}

        {error && (
          <div className="rounded-md px-3 py-2 text-sm" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null)
                setRecarga((valor) => valor + 1)
              }}
              className="mt-1 font-semibold underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargando && datos && (
          <>
            {/* Avance contra el total esperado */}
            <section className="rounded-lg bg-white p-5" style={{ border: '1px solid #e2e8f0' }}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avance</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {datos.resumen.levantadas}{' '}
                    <span className="text-base font-medium text-slate-400">
                      de {datos.resumen.totalEsperado}
                    </span>
                  </p>
                </div>
                <p className="text-sm font-semibold" style={{ color: '#1d4ed8' }}>
                  {datos.resumen.avancePct}%
                </p>
              </div>

              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full" style={{ background: '#e2e8f0' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(datos.resumen.avancePct, 100)}%`,
                    background: '#1d4ed8',
                  }}
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Faltan {datos.resumen.faltantes} parcelas para completar el levantamiento.
              </p>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {datos.distribucion.map((item) => (
                  <div key={item.estado} className="rounded-md p-3" style={{ background: '#f8fafc' }}>
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="text-lg font-bold text-slate-900">{item.cantidad}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Cobertura de servicios */}
            <section className="rounded-lg bg-white p-5" style={{ border: '1px solid #e2e8f0' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">Cobertura de servicios</h2>
                {serviciosEnDeficit.length > 0 && (
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                    {serviciosEnDeficit.length} en déficit
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-slate-500">
                El porcentaje se calcula sobre las parcelas que declararon el servicio, no
                sobre el total. Los casos sin dato se muestran aparte.
              </p>

              <div className="mt-4 space-y-3">
                {datos.cobertura.map((servicio) => (
                  <div key={servicio.key}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{servicio.label}</p>
                      <p className="text-xs text-slate-500">
                        {servicio.cubiertas} de {servicio.declaradas} declaradas ·{' '}
                        <span className="font-semibold text-slate-700">{servicio.coberturaPct}%</span>
                        {servicio.sinDato > 0 && ` · ${servicio.sinDato} sin dato`}
                      </p>
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: '#e2e8f0' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${servicio.coberturaPct}%`,
                            background: servicio.enDeficit ? '#dc2626' : '#16a34a',
                          }}
                        />
                      </div>
                      {servicio.enDeficit && (
                        <span className="text-xs font-semibold" style={{ color: '#b91c1c' }}>
                          déficit
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Equipamiento */}
            <section className="rounded-lg bg-white p-5" style={{ border: '1px solid #e2e8f0' }}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-slate-900">Equipamiento urbano</h2>
                {equipamientoSaturado.length > 0 && (
                  <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
                    {equipamientoSaturado.length} saturados
                  </span>
                )}
              </div>

              {datos.equipamiento.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  Todavía no hay parcelas con equipamiento declarado.
                </p>
              ) : (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-2">Tipo</th>
                      <th className="py-1.5 pr-2">Cantidad</th>
                      <th className="py-1.5 pr-2">Parcelas por unidad</th>
                      <th className="py-1.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.equipamiento.map((item) => (
                      <tr key={item.tipo} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td className="py-1.5 pr-2 text-slate-800">{item.tipo}</td>
                        <td className="py-1.5 pr-2 text-slate-600">{item.cantidad}</td>
                        <td className="py-1.5 pr-2 text-slate-600">{item.parcelasPorUnidad ?? '—'}</td>
                        <td className="py-1.5">
                          {item.saturado ? (
                            <span className="text-xs font-semibold" style={{ color: '#92400e' }}>
                              saturado
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">ok</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Mapa */}
            <section className="rounded-lg overflow-hidden bg-white" style={{ border: '1px solid #e2e8f0' }}>
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <h2 className="text-base font-bold text-slate-900">Mapa del levantamiento</h2>
                <p className="text-xs text-slate-500">
                  {datos.puntos.length} parcelas · {datos.celdas.length} celdas de densidad
                </p>
              </div>
              <div style={{ height: 480 }}>
                <MapaCalor celdas={datos.celdas} puntos={datos.puntos} />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}
