'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Crosshair, Plus, X } from 'lucide-react'
import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import type { MapViewProps } from '@/components/MapView'
import type { Parcela } from '@/lib/domain/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import FormularioParcela from '@/components/field/FormularioParcela'
import GeometriaPanel from '@/components/field/GeometriaPanel'
import PanelCapas from '@/components/field/PanelCapas'
import PanelDescargarMapa from '@/components/field/PanelDescargarMapa'
import GpsIndicator from '@/components/field/GpsIndicator'
import SyncStatus from '@/components/field/SyncStatus'
import { NavBar } from '@/components/NavBar'
import { useSync } from '@/components/field/SyncProvider'
import { useSchemas } from '@/lib/field/use-schemas'
import { useCapas } from '@/lib/field/use-capas'
import { usePoligono } from '@/lib/field/use-poligono'
import { useGeolocation } from '@/lib/field/use-geolocation'
import { shouldFollowSensor, type OrigenPosicion } from '@/lib/domain/gps'
import { ubicacionDeParcela } from '@/lib/domain/parcela'

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
  loading: () => <div className="relative h-full w-full overflow-hidden bg-[#f3f5f2]" aria-label="Cargando mapa" role="status">
    <Skeleton className="absolute left-[18%] top-[20%] h-8 w-40 bg-white/80" />
    <Skeleton className="absolute left-[40%] top-[42%] size-12 rounded-full bg-white/80" />
    <Skeleton className="absolute bottom-5 left-4 h-9 w-32 bg-white/80" />
    <span className="absolute bottom-5 right-4 text-xs text-slate-500">Cargando mapa…</span>
  </div>,
})

/**
 * El editor de polígono también se carga solo en el cliente: usa Leaflet y no
 * puede evaluarse durante el prerender del servidor.
 */
const PolygonEditor = dynamic(() => import('@/components/field/PolygonEditor'), {
  ssr: false,
})

/**
 * La superposición también se carga solo en el cliente: `leaflet` toca
 * `window` al importarse y el prerender del servidor no lo tiene.
 */
const CapaSuperpuesta = dynamic(() => import('@/components/field/CapaSuperpuesta'), {
  ssr: false,
})

const CENTRO_INICIAL = { lat: 10.4806, lng: -66.9036 }

function FormularioSkeleton() {
  return (
    <div className="space-y-3" aria-label="Cargando formulario" role="status">
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

export default function CampoPage() {
  const { esquemas, cargando, desdeCache, error, recargar } = useSchemas()
  const { encolar } = useSync()
  const poligono = usePoligono()
  const capas = useCapas()
  const geo = useGeolocation()

  const [posicionManual, setPosicionManual] = useState(CENTRO_INICIAL)
  const [origen, setOrigen] = useState<OrigenPosicion>('sensor')
  const [parcelaEnEdicion, setParcelaEnEdicion] = useState<Parcela | null>(null)
  /**
   * Distingue la posición que traía la parcela guardada de una que el
   * levantador puso a mano. La fuente (`gps.fuente`) solo puede cambiar a
   * `manual` si el pin se movió de verdad.
   */
  const [posicionTocada, setPosicionTocada] = useState(false)
  /** Coordenadas a las que el mapa vuela al abrir una parcela guardada. */
  const [enfoque, setEnfoque] = useState<{ lat: number; lng: number; zoom?: number } | null>(null)
  const [formularioAbierto, setFormularioAbierto] = useState(false)
  const [temaMapa, setTemaMapa] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const sincronizarTema = (event: Event) => {
      const detail = (event as CustomEvent<'light' | 'dark'>).detail
      setTemaMapa(detail === 'dark' ? 'dark' : 'light')
    }
    const guardado = window.localStorage.getItem('geopin-theme')
    if (guardado === 'light' || guardado === 'dark') setTemaMapa(guardado)
    window.addEventListener('geopin-theme-change', sincronizarTema)
    return () => window.removeEventListener('geopin-theme-change', sincronizarTema)
  }, [])

  const trazando = poligono.modo === 'trazando'

  /**
   * Si la URL trae `?parcela=<id>`, se edita esa parcela: se precarga el
   * formulario, su geometría y las versiones de cada módulo, que son las que
   * permiten al servidor detectar el conflicto si otro Companero editó el
   * mismo módulo mientras tanto.
   */
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('parcela')
    if (!id) return

    let vivo = true

    void fetch(`/api/parcelas/${encodeURIComponent(id)}`, { credentials: 'same-origin' })
      .then((respuesta) => (respuesta.ok ? respuesta.json() : null))
      .then((cuerpo: { parcela?: Parcela } | null) => {
        if (!vivo || !cuerpo?.parcela) return

        const parcela = cuerpo.parcela
        // Con polígono, la ubicación es el primer vértice del contorno: el
        // pin tiene que caer sobre la parcela y no donde estaba el teléfono.
        const { lat, lng } = ubicacionDeParcela(parcela)

        setParcelaEnEdicion(parcela)
        // El pin arranca donde se guardó la parcela. Sin esto el marcador
        // seguía al GPS y el mapa mostraba la ubicación del dispositivo en
        // vez de la del pin que se está editando.
        setPosicionManual({ lat, lng })
        setOrigen('manual')
        setPosicionTocada(false)
        setEnfoque({ lat, lng, zoom: 17 })
      })
      .catch(() => {})

    return () => {
      vivo = false
    }
  }, [])

  useEffect(() => {
    if (!parcelaEnEdicion) return
    poligono.cargar(
      parcelaEnEdicion.geometria ?? null,
      parcelaEnEdicion.areaM2 !== undefined ? String(parcelaEnEdicion.areaM2) : '',
    )
    // Solo al cambiar de parcela: recargar en cada render borraría el trazado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelaEnEdicion?.id])

  /**
   * El pin sigue al sensor **derivado en el render**, no guardado en estado:
   * se mueve solo cuando la lectura pasa el filtro de 15 m y la posición no
   * fue puesta a mano. Es la regla de S3 y S5.
   *
   * Con un efecto, el pin se movía en un segundo render: un estado que
   * cambia dentro de un efecto provoca un render en cascada.
   */
  const posicionSensor = useMemo(() => {
    if (!geo.reading || !shouldFollowSensor(origen, geo.reading)) return null
    return {
      lat: geo.reading.lat,
      lng: geo.reading.lng,
      precision: geo.reading.accuracy,
    }
  }, [geo.reading, origen])

  const ubicacion = posicionSensor ?? posicionManual

  /**
   * Volver al sensor es una acción explícita del levantador: es la
   * confirmación que pide S5 antes de descartar la posición manual.
   */
  const usarMiUbicacion = useCallback(() => {
    // Con el origen en "sensor", la posición derivada vuelve a seguir al
    // GPS en el próximo render: no hace falta escribirla a mano.
    setOrigen('sensor')
    setPosicionTocada(false)
    geo.reiniciar()
  }, [geo])

  const onPositionChange = useCallback((lat: number, lng: number) => {
    setPosicionManual({ lat, lng })
    setOrigen('manual')
    setPosicionTocada(true)
  }, [])

  const gps = useMemo(() => {
    if (posicionSensor) {
      return { fuente: 'sensor' as const, precision: posicionSensor.precision }
    }

    // Al editar una parcela sin mover el pin, la ubicación sigue siendo la
    // del documento: conserva la fuente con la que se levantó. Si el pin se
    // movió, la fuente pasa a manual.
    if (parcelaEnEdicion && !posicionTocada && parcelaEnEdicion.gps) {
      return parcelaEnEdicion.gps
    }

    return { fuente: 'manual' as const }
  }, [posicionSensor, parcelaEnEdicion, posicionTocada])

  async function onGuardar(payload: ParcelaCreateRequest) {
    await encolar(payload)
    poligono.limpiar()
  }

  return (
    <main className="h-[100dvh] flex flex-col overflow-hidden bg-background">
      <NavBar />

      <div className="bg-background/95 text-foreground border-b flex flex-wrap items-center gap-3 px-3 py-1.5 shadow-sm z-10 shrink-0 sm:px-5 sm:py-2">
        <GpsIndicator fix={geo.fix} accuracy={geo.reading?.accuracy} />
        <SyncStatus />
        {parcelaEnEdicion && (
          <span className="ml-auto text-xs text-primary-foreground/70">
            Editando: {parcelaEnEdicion.nombre}
          </span>
        )}
      </div>

      <div className="relative flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row">
        <aside className="hidden md:block md:w-[400px] shrink-0 overflow-y-auto p-4 space-y-4 border-r border-border bg-background">
          <GpsIndicator
            fix={geo.fix}
            accuracy={geo.reading?.accuracy}
            variant="panel"
            onReintentar={usarMiUbicacion}
          />

          {origen === 'manual' && (
            <Alert>
              <AlertDescription>
                <p>
                  {parcelaEnEdicion && !posicionTocada
                    ? 'Posición guardada de la parcela. El sensor no la va a mover.'
                    : 'Posición puesta a mano. El sensor no la va a mover.'}
                </p>
                <Button type="button" variant="link" size="xs" onClick={usarMiUbicacion}>
                  Usar mi ubicación
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {cargando && <FormularioSkeleton />}

          {!cargando && (desdeCache || error) && (
            <Alert variant={error ? 'destructive' : 'default'}>
              <AlertDescription>
                <p>{error}</p>
                <Button type="button" variant="link" size="xs" onClick={recargar}>
                  Reintentar
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <GeometriaPanel poligono={poligono} deshabilitado={cargando} />

          <PanelDescargarMapa
            puntos={poligono.draft}
            posicionActual={{ lat: ubicacion.lat, lng: ubicacion.lng }}
          />

          {!cargando && (
            <FormularioParcela
              // El `key` reinicia el formulario cuando cambia la parcela en
              // edición: es el patrón que React recomienda para resetear
              // estado con una prop, y evita un setState dentro de un efecto.
              key={parcelaEnEdicion?.id ?? 'nueva'}
              esquemas={esquemas}
              id={parcelaEnEdicion?.id}
              initial={parcelaEnEdicion}
              ubicacion={ubicacion}
              gps={gps}
              geometria={poligono.geometria}
              areaM2={poligono.areaEfectiva}
              perimetroM={poligono.perimetroGeometria}
              onGuardar={onGuardar}
            />
          )}
        </aside>

        <div className={`absolute inset-0 md:relative md:flex-1 md:min-h-0 ${temaMapa === 'dark' ? 'theme-map-light' : 'bg-white'}`}>
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
            capas={capas.capas}
            capaBase={capas.baseActiva}
            enfoque={enfoque}
            onPositionChange={onPositionChange}
            onGPSStatus={() => {}}
            onDeletePin={() => {}}
            onEditPin={() => {}}
          >
            {capas.capas
              .filter(
                (capa) =>
                  capa.tipo === 'superposicion' && capas.overlaysVisibles.includes(capa.id),
              )
              .map((capa) => (
                <CapaSuperpuesta
                  key={capa.id}
                  capa={capa}
                  opacidad={capas.opacidades[capa.id] ?? capa.opacity}
                />
              ))}

            <PolygonEditor
              draft={poligono.draft}
              geometria={poligono.geometria}
              trazando={trazando}
              onAgregar={poligono.agregar}
              onMover={poligono.mover}
              onQuitar={poligono.quitar}
            />
          </MapView>

          <PanelCapas
            capas={capas.capas}
            baseActiva={capas.baseActiva}
            onCambiarBase={capas.setBaseActiva}
            overlaysVisibles={capas.overlaysVisibles}
            onToggleOverlay={capas.toggleOverlay}
            opacidades={capas.opacidades}
            onCambiarOpacidad={capas.setOpacidad}
          />

          <div className="absolute right-3 top-3 z-[1001] flex flex-col gap-2 md:hidden">
            <Button type="button" size="icon-lg" variant="outline" aria-label="Usar mi ubicación" className="size-11 rounded-full bg-background shadow-lg" onClick={usarMiUbicacion}>
              <Crosshair />
            </Button>
          </div>
          {!formularioAbierto && (
            <Button type="button" size="lg" className="absolute bottom-5 right-4 z-[1001] h-12 rounded-full px-5 shadow-xl md:hidden" onClick={() => setFormularioAbierto(true)}>
              <Plus /> Nuevo registro
            </Button>
          )}
          {formularioAbierto && (
            <div className="absolute inset-x-0 bottom-0 z-[1002] flex max-h-[82%] flex-col rounded-t-2xl border-t bg-background shadow-2xl md:hidden">
              <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
                <div><p className="text-sm font-semibold">{parcelaEnEdicion ? 'Editar parcela' : 'Nuevo levantamiento'}</p><p className="text-xs text-muted-foreground">Pin o perímetro · completa los datos</p></div>
                <Button type="button" variant="ghost" size="icon" aria-label="Cerrar formulario" onClick={() => setFormularioAbierto(false)}><X /></Button>
              </div>
              <div className="space-y-4 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <GpsIndicator fix={geo.fix} accuracy={geo.reading?.accuracy} variant="panel" onReintentar={usarMiUbicacion} />
                {origen === 'manual' && <Alert><AlertDescription><p>{parcelaEnEdicion && !posicionTocada ? 'Posición guardada de la parcela. El sensor no la va a mover.' : 'Posición puesta a mano. El sensor no la va a mover.'}</p><Button type="button" variant="link" size="xs" onClick={usarMiUbicacion}>Usar mi ubicación</Button></AlertDescription></Alert>}
                {cargando && <FormularioSkeleton />}
                {!cargando && (desdeCache || error) && <Alert variant={error ? 'destructive' : 'default'}><AlertDescription><p>{error}</p><Button type="button" variant="link" size="xs" onClick={recargar}>Reintentar</Button></AlertDescription></Alert>}
                <GeometriaPanel poligono={poligono} deshabilitado={cargando} />
                <PanelDescargarMapa puntos={poligono.draft} posicionActual={{ lat: ubicacion.lat, lng: ubicacion.lng }} />
                {!cargando && <FormularioParcela key={parcelaEnEdicion?.id ?? 'nueva'} esquemas={esquemas} id={parcelaEnEdicion?.id} initial={parcelaEnEdicion} ubicacion={ubicacion} gps={gps} geometria={poligono.geometria} areaM2={poligono.areaEfectiva} perimetroM={poligono.perimetroGeometria} onGuardar={onGuardar} />}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
