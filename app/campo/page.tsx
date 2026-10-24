'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import type { MapViewProps } from '@/components/MapView'
import FormularioParcela from '@/components/field/FormularioParcela'
import GeometriaPanel from '@/components/field/GeometriaPanel'
import GpsIndicator from '@/components/field/GpsIndicator'
import SyncStatus from '@/components/field/SyncStatus'
import { useSync } from '@/components/field/SyncProvider'
import { useSchemas } from '@/lib/field/use-schemas'
import { usePoligono } from '@/lib/field/use-poligono'
import { useGeolocation } from '@/lib/field/use-geolocation'
import { shouldFollowSensor, type OrigenPosicion } from '@/lib/domain/gps'

/**
 * Página de campo v2.
 *
 * Los campos salen del esquema publicado, la geometría se traza sobre el
 * mapa y el GPS se lee en continuo filtrando por precisión.
 *
 * El estado del polígono y el de la posición viven acá porque los comparten
 * el panel y el mapa.
 */

const MapView = dynamic<MapViewProps>(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-slate-100">
      <p className="text-sm text-slate-500 font-medium">Cargando mapa…</p>
    </div>
  ),
})

/**
 * El editor de polígono también se carga solo en el cliente: usa Leaflet y no
 * puede evaluarse durante el prerender del servidor.
 */
const PolygonEditor = dynamic(() => import('@/components/field/PolygonEditor'), {
  ssr: false,
})

const CENTRO_INICIAL = { lat: 10.4806, lng: -66.9036 }

export default function CampoPage() {
  const { esquemas, cargando, desdeCache, error, recargar } = useSchemas()
  const { encolar } = useSync()
  const poligono = usePoligono()
  const geo = useGeolocation()

  const [ubicacion, setUbicacion] = useState(CENTRO_INICIAL)
  const [origen, setOrigen] = useState<OrigenPosicion>('sensor')
  const [precision, setPrecision] = useState<number | undefined>()

  const trazando = poligono.modo === 'trazando'

  /**
   * El pin solo sigue al sensor cuando la lectura pasa el filtro de 15 m y
   * la posición no fue puesta a mano. Es la regla de S3 y S5.
   */
  useEffect(() => {
    if (!shouldFollowSensor(origen, geo.reading)) return

    const lectura = geo.reading!
    setUbicacion({ lat: lectura.lat, lng: lectura.lng })
    setPrecision(lectura.accuracy)
  }, [geo.reading, origen])

  /**
   * Volver al sensor es una acción explícita del levantador: es la
   * confirmación que pide S5 antes de descartar la posición manual.
   */
  const usarMiUbicacion = useCallback(() => {
    setOrigen('sensor')
    geo.reiniciar()

    if (geo.reading && shouldFollowSensor('sensor', geo.reading)) {
      setUbicacion({ lat: geo.reading.lat, lng: geo.reading.lng })
      setPrecision(geo.reading.accuracy)
    }
  }, [geo])

  const onPositionChange = useCallback((lat: number, lng: number) => {
    setUbicacion({ lat, lng })
    setOrigen('manual')
    setPrecision(undefined)
  }, [])

  const gps = useMemo(
    () =>
      precision !== undefined
        ? { fuente: 'sensor' as const, precision }
        : { fuente: 'manual' as const },
    [precision],
  )

  async function onGuardar(payload: ParcelaCreateRequest) {
    await encolar(payload)
    poligono.limpiar()
  }

  return (
    <main className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <header
        className="flex flex-wrap items-center gap-3 px-3 py-3 shadow-sm z-20 shrink-0 sm:px-5"
        style={{ background: '#1e3a5f' }}
      >
        <div>
          <h1 className="font-bold text-base leading-none text-white tracking-tight">GeoPin</h1>
          <p className="hidden text-xs leading-none mt-0.5 sm:block" style={{ color: '#93c5fd' }}>
            Captura de parcela
          </p>
        </div>
        <GpsIndicator fix={geo.fix} accuracy={geo.reading?.accuracy} />
        <SyncStatus />
        <a href="/admin/esquema" className="ml-auto text-xs text-white underline">
          Esquemas
        </a>
      </header>

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <aside
          className="w-full md:w-[400px] shrink-0 overflow-y-auto p-4 space-y-4"
          style={{ borderRight: '1px solid #e2e8f0' }}
        >
          <GpsIndicator
            fix={geo.fix}
            accuracy={geo.reading?.accuracy}
            variant="panel"
            onReintentar={usarMiUbicacion}
          />

          {origen === 'manual' && (
            <div className="rounded-md px-3 py-2 text-xs" style={{ background: '#f1f5f9', color: '#334155' }}>
              <p>Posición puesta a mano. El sensor no la va a mover.</p>
              <button type="button" onClick={usarMiUbicacion} className="mt-1 font-semibold underline">
                Usar mi ubicación
              </button>
            </div>
          )}

          {cargando && <p className="text-sm text-slate-500">Cargando formulario…</p>}

          {!cargando && (desdeCache || error) && (
            <div className="rounded-md px-3 py-2 text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>
              <p>{error}</p>
              <button type="button" onClick={recargar} className="mt-1 font-semibold underline">
                Reintentar
              </button>
            </div>
          )}

          <GeometriaPanel poligono={poligono} deshabilitado={cargando} />

          {!cargando && (
            <FormularioParcela
              esquemas={esquemas}
              ubicacion={ubicacion}
              gps={gps}
              geometria={poligono.geometria}
              areaM2={poligono.areaEfectiva}
              perimetroM={poligono.perimetroGeometria}
              onGuardar={onGuardar}
            />
          )}
        </aside>

        <div className="flex-1 relative min-h-[50vh]">
          <MapView
            lat={ubicacion.lat}
            lng={ubicacion.lng}
            categoria="vivienda"
            savedPins={[]}
            // Mientras se traza, cada toque agrega un vértice en vez de
            // mover el pin.
            clickToPosition={!trazando}
            // El GPS lo maneja el hook, que filtra por precisión: el mapa no
            // tiene que pedir su propia lectura.
            autoLocate={false}
            onLocateRequest={usarMiUbicacion}
            onPositionChange={onPositionChange}
            onGPSStatus={() => {}}
            onDeletePin={() => {}}
            onEditPin={() => {}}
          >
            <PolygonEditor
              draft={poligono.draft}
              geometria={poligono.geometria}
              trazando={trazando}
              onAgregar={poligono.agregar}
              onMover={poligono.mover}
              onQuitar={poligono.quitar}
            />
          </MapView>
        </div>
      </div>
    </main>
  )
}
