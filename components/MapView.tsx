'use client'

import { useEffect, useRef, useCallback } from 'react'
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Pin, Category } from '@/lib/types'
import { getCategoryConfig } from '@/lib/categories'
import { getUrbanDetails } from '@/lib/urban-options'
import { capasBasePorDefecto, capasDeTipo, type CapaMapa } from '@/lib/map/capas'

// ---------------------------------------------------------------------------
// Icon factory — uses divIcon so no webpack asset-path issues
// color funcional de mapa: el pin usa la paleta de categorías del dominio
// ---------------------------------------------------------------------------
function createCategoryIcon(categoria: string, size = 32): L.DivIcon {
  const cat = getCategoryConfig(categoria)
  const abbr = cat.abbr
  const fontSize = abbr.length > 2 ? '8px' : abbr.length > 1 ? '10px' : '13px'

  return L.divIcon({
    html: `
      <div style="
        background-color:${cat.color};
        width:${size}px;height:${size}px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2.5px solid var(--background);
        box-shadow:var(--shadow-md);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="
          transform:rotate(45deg);
          color:var(--primary-foreground);
          font-size:${fontSize};
          font-weight:700;
          font-family:var(--font-sans);
          line-height:1;
          pointer-events:none;
          user-select:none;
          letter-spacing:-0.5px;
        ">${abbr}</span>
      </div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -(size + 6)],
  })
}

function createDraggableIcon(categoria: Category): L.DivIcon {
  const cat = getCategoryConfig(categoria)
  const abbr = cat.abbr
  const size = 38
  const fontSize = abbr.length > 2 ? '9px' : abbr.length > 1 ? '11px' : '15px'

  return L.divIcon({
    html: `
      <div style="
        background-color:${cat.color};
        width:${size}px;height:${size}px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid var(--background);
        box-shadow:var(--shadow-lg);
        display:flex;align-items:center;justify-content:center;
        cursor:grab;
      ">
        <span style="
          transform:rotate(45deg);
          color:var(--primary-foreground);
          font-size:${fontSize};
          font-weight:700;
          font-family:var(--font-sans);
          line-height:1;
          pointer-events:none;
          user-select:none;
          letter-spacing:-0.5px;
        ">${abbr}</span>
      </div>
      <div style="
        position:absolute;top:-8px;right:-8px;
        background:var(--primary);color:var(--primary-foreground);
        border-radius:50%;width:18px;height:18px;
        font-size:10px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        border:2px solid var(--background);
        box-shadow:var(--shadow-sm);
        pointer-events:none;
      ">+</div>`,
    className: 'relative',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -(size + 6)],
  })
}

// ---------------------------------------------------------------------------
// Inner components (must live inside <MapContainer> to use useMap/useMapEvents)
// ---------------------------------------------------------------------------

interface GPSDetectorProps {
  onPositionChange: (lat: number, lng: number) => void
  onGPSStatus: (status: 'searching' | 'found' | 'error' | 'denied') => void
}

function GPSDetector({ onPositionChange, onGPSStatus }: GPSDetectorProps) {
  const map = useMap()
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    if (!navigator.geolocation) {
      onGPSStatus('error')
      return
    }

    onGPSStatus('searching')

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onGPSStatus('found')
        map.flyTo([coords.latitude, coords.longitude], 17, { animate: true, duration: 1.2 })
        onPositionChange(coords.latitude, coords.longitude)
      },
      (err) => {
        onGPSStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error')
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }, [map, onPositionChange, onGPSStatus])

  return null
}

interface MapClickHandlerProps {
  onPositionChange: (lat: number, lng: number) => void
  enabled: boolean
}

function MapClickHandler({ onPositionChange, enabled }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      if (!enabled) return
      onPositionChange(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

/**
 * Vuela a un punto cuando cambia.
 *
 * `MapContainer` solo respeta `center` al montarse; sin esto, abrir una
 * parcela guardada dejaba la cámara donde estaba el dispositivo y el pin
 * aparecía fuera de pantalla.
 */
function EnfoqueMapa({ enfoque }: { enfoque?: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap()
  const lat = enfoque?.lat
  const lng = enfoque?.lng
  const zoom = enfoque?.zoom

  useEffect(() => {
    if (lat === undefined || lng === undefined) return
    map.flyTo([lat, lng], zoom ?? Math.max(map.getZoom(), 17), { animate: true, duration: 1.2 })
  }, [map, lat, lng, zoom])

  return null
}

function MapActionControls({
  onPositionChange,
  onGPSStatus,
  onLocateRequest,
}: {
  onPositionChange: (lat: number, lng: number) => void
  onGPSStatus: (status: 'searching' | 'found' | 'error' | 'denied') => void
  onLocateRequest?: () => void
}) {
  const map = useMap()

  const handleLocateMe = useCallback(() => {
    // Si el llamador maneja el GPS, no se pide una lectura acá: una lectura
    // suelta no pasa por el filtro de precisión y movería el pin sin avisar.
    if (onLocateRequest) {
      onLocateRequest()
      return
    }

    if (!navigator.geolocation) {
      onGPSStatus('error')
      return
    }

    onGPSStatus('searching')

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onGPSStatus('found')
        map.flyTo([coords.latitude, coords.longitude], 17, { animate: true, duration: 1.2 })
        onPositionChange(coords.latitude, coords.longitude)
      },
      (err) => {
        onGPSStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error')
      },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }, [map, onGPSStatus, onPositionChange, onLocateRequest])

  return (
    <div className="absolute right-4 bottom-7 z-[1000] flex flex-col gap-1">
      <Button
        variant="outline"
        size="icon"
        onClick={handleLocateMe}
        aria-label="Usar mi ubicación"
        title="Usar mi ubicación"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => map.zoomIn()}
        aria-label="Acercar"
        title="Acercar"
      >
        +
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => map.zoomOut()}
        aria-label="Alejar"
        title="Alejar"
      >
        −
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public props & default export
// ---------------------------------------------------------------------------

export interface MapViewProps {
  lat: number
  lng: number
  categoria: Category
  savedPins: Pin[]
  onPositionChange: (lat: number, lng: number) => void
  onGPSStatus: (status: 'searching' | 'found' | 'error' | 'denied') => void
  onDeletePin: (id: string) => void
  onEditPin: (pin: Pin) => void
  /**
   * Si es `false`, un clic en el mapa no mueve el pin. Se usa mientras se
   * traza el polígono de la parcela: cada toque tiene que agregar un vértice,
   * no reubicar el marcador.
   */
  clickToPosition?: boolean
  /**
   * Si es `false`, el mapa no busca la ubicación al montarse. La página de
   * campo v2 maneja el GPS con su propio hook, que filtra por precisión.
   */
  autoLocate?: boolean
  /** Reemplaza el comportamiento del botón "usar mi ubicación". */
  onLocateRequest?: () => void
  /**
   * Configuración de las capas del mapa. Si no se pasa, se usan las dos
   * fuentes de siempre.
   */
  capas?: CapaMapa[]
  /** Capa base activa. */
  capaBase?: string
  /** Capas y controles que se dibujan dentro del mapa. */
  children?: React.ReactNode
  /**
   * Punto al que el mapa vuela cuando cambia. Se usa para abrir una parcela
   * guardada en sus coordenadas y no en las del dispositivo.
   */
  enfoque?: { lat: number; lng: number; zoom?: number } | null
  /** Centro neutral usado mientras el dispositivo aún no entrega GPS. */
  initialView?: { lat: number; lng: number; zoom: number }
  /** Lectura aproximada del dispositivo que aún no alcanza la precisión de captura. */
  previewPosition?: { lat: number; lng: number; accuracy: number } | null
  /** Oculta el pin de captura provisional cuando todavía no hay ubicación fiable. */
  showPositionMarker?: boolean
}

export default function MapView({
  lat,
  lng,
  categoria,
  savedPins,
  onPositionChange,
  onGPSStatus,
  onDeletePin,
  onEditPin,
  clickToPosition = true,
  autoLocate = true,
  onLocateRequest,
  capas,
  capaBase,
  children,
  enfoque,
  initialView,
  previewPosition,
  showPositionMarker = true,
}: MapViewProps) {
  const hasValidPosition = lat !== 0 || lng !== 0

  /**
   * Las capas base nunca pueden quedar vacías: `LayersControl` de Leaflet
   * lanza si no tiene ninguna. Además, antes de que llegue la configuración
   * del servidor el array está vacío, así que el respaldo tiene que ser
   * explícito.
   */
  const capasBase =
    capas && capasDeTipo(capas, 'base').length > 0
      ? capasDeTipo(capas, 'base')
      : capasBasePorDefecto('')
  const baseActiva = capaBase ?? capasBase[0]?.id

  const handleDragEnd = useCallback(
    (e: L.DragEndEvent) => {
      const pos = (e.target as L.Marker).getLatLng()
      onPositionChange(pos.lat, pos.lng)
    },
    [onPositionChange],
  )

  // Default center: Caracas, Venezuela
  const defaultCenter: [number, number] = initialView
    ? [initialView.lat, initialView.lng]
    : hasValidPosition
      ? [lat, lng]
      : [10.4806, -66.9036]

  return (
    <MapContainer
      center={defaultCenter}
      zoom={initialView?.zoom ?? (hasValidPosition ? 16 : 6)}
      className="h-full w-full"
      zoomControl={false}
      scrollWheelZoom
    >
      {capasBase.map((capa) => capa.id === baseActiva && (
        <TileLayer key={capa.id} url={capa.url} attribution={capa.attribution} />
      ))}

      {autoLocate && <GPSDetector onPositionChange={onPositionChange} onGPSStatus={onGPSStatus} />}
      <EnfoqueMapa enfoque={enfoque} />
      <MapClickHandler onPositionChange={onPositionChange} enabled={clickToPosition} />
      <MapActionControls
        onPositionChange={onPositionChange}
        onGPSStatus={onGPSStatus}
        onLocateRequest={onLocateRequest}
      />
      {children}

      {previewPosition && (
        <>
          <Circle
            center={[previewPosition.lat, previewPosition.lng]}
            radius={previewPosition.accuracy}
            pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.12, weight: 2 }}
          />
          <CircleMarker
            center={[previewPosition.lat, previewPosition.lng]}
            radius={8}
            pathOptions={{ color: '#fff', fillColor: '#2563eb', fillOpacity: 1, weight: 3 }}
          >
            <Popup>
              <div className="text-sm font-semibold">Tu ubicación aproximada</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Precisión actual: ±{Math.round(previewPosition.accuracy)} m. El pin de captura se fijará cuando mejore la señal.
              </div>
            </Popup>
          </CircleMarker>
        </>
      )}

      {/* Active / draggable marker */}
      {showPositionMarker && hasValidPosition && (
        <Marker
          position={[lat, lng]}
          draggable
          icon={createDraggableIcon(categoria)}
          eventHandlers={{ dragend: handleDragEnd }}
        >
          <Popup>
            <div className="min-w-[140px]">
              {/* div y no p: Leaflet fuerza `margin: 1.3em 0` a los p del popup. */}
              <div className="mb-1 text-sm font-semibold">Posicion actual</div>
              <div className="font-mono text-xs text-muted-foreground">
                {lat.toFixed(6)},{' '}
                {lng.toFixed(6)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/80">
                Arrastra para mover o haz clic en el mapa
              </div>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Saved pins */}
      {savedPins.map((pin) => {
        const cat = getCategoryConfig(pin.categoria)
        const urbanDetails = getUrbanDetails(pin)
        return (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={createCategoryIcon(pin.categoria)}
          >
            <Popup>
              <div className="min-w-[180px] max-w-[220px]">
                <Badge variant="secondary" className="mb-1.5">
                  {cat.label}
                </Badge>
                {/* div y no p: Leaflet fuerza `margin: 1.3em 0` a los p del popup. */}
                <div className="mb-1 text-sm font-bold">{pin.nombre}</div>
                {pin.descripcion && (
                  <div className="mb-1.5 text-xs text-muted-foreground">
                    {pin.descripcion}
                  </div>
                )}
                {urbanDetails.length > 0 && (
                  <dl className="my-2 grid max-h-[180px] grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 overflow-y-auto text-xs">
                    {urbanDetails.map((detail) => (
                      <div key={detail.label} className="contents">
                        <dt className="text-muted-foreground">{detail.label}</dt>
                        <dd className="text-right font-semibold text-foreground">{detail.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="mb-2 font-mono text-xs text-muted-foreground">
                  {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => onEditPin(pin)}
                    aria-label={`Editar ${pin.nombre}`}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="xs"
                    onClick={() => onDeletePin(pin.id)}
                    aria-label={`Eliminar ${pin.nombre}`}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
