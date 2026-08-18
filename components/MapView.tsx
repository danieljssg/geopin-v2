'use client'

import { useEffect, useRef, useCallback } from 'react'
import { LayersControl, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Pin, Category } from '@/lib/types'
import { CATEGORIAS } from '@/lib/categories'
import { getUrbanDetails } from '@/lib/urban-options'

// ---------------------------------------------------------------------------
// Icon factory — uses divIcon so no webpack asset-path issues
// ---------------------------------------------------------------------------
function createCategoryIcon(categoria: Category, size = 32): L.DivIcon {
  const cat = CATEGORIAS[categoria]
  const abbr = cat.abbr
  const fontSize = abbr.length > 2 ? '8px' : abbr.length > 1 ? '10px' : '13px'

  return L.divIcon({
    html: `
      <div style="
        background-color:${cat.color};
        width:${size}px;height:${size}px;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2.5px solid #fff;
        box-shadow:0 2px 6px rgba(0,0,0,.35);
        display:flex;align-items:center;justify-content:center;
      ">
        <span style="
          transform:rotate(45deg);
          color:#fff;
          font-size:${fontSize};
          font-weight:700;
          font-family:ui-sans-serif,system-ui,sans-serif;
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
  const cat = CATEGORIAS[categoria]
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
        border:3px solid #fff;
        box-shadow:0 3px 10px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;
        cursor:grab;
      ">
        <span style="
          transform:rotate(45deg);
          color:#fff;
          font-size:${fontSize};
          font-weight:700;
          font-family:ui-sans-serif,system-ui,sans-serif;
          line-height:1;
          pointer-events:none;
          user-select:none;
          letter-spacing:-0.5px;
        ">${abbr}</span>
      </div>
      <div style="
        position:absolute;top:-8px;right:-8px;
        background:#1d4ed8;color:#fff;
        border-radius:50%;width:18px;height:18px;
        font-size:10px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        border:2px solid #fff;
        box-shadow:0 1px 3px rgba(0,0,0,.3);
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
}

function MapClickHandler({ onPositionChange }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function MapActionControls({
  onPositionChange,
  onGPSStatus,
}: {
  onPositionChange: (lat: number, lng: number) => void
  onGPSStatus: (status: 'searching' | 'found' | 'error' | 'denied') => void
}) {
  const map = useMap()

  const btnStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    boxShadow: '0 1px 5px rgba(0,0,0,.18)',
    cursor: 'pointer',
    fontSize: 22,
    fontWeight: 600,
    color: '#1e3a5f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    userSelect: 'none',
    transition: 'background .15s',
  }

  const handleLocateMe = useCallback(() => {
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
  }, [map, onGPSStatus, onPositionChange])

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 28,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <button
        style={btnStyle}
        onClick={handleLocateMe}
        aria-label="Usar mi ubicación"
        title="Usar mi ubicación"
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#f0f4ff')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </button>
      <button
        style={btnStyle}
        onClick={() => map.zoomIn()}
        aria-label="Acercar"
        title="Acercar"
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#f0f4ff')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
      >
        +
      </button>
      <button
        style={btnStyle}
        onClick={() => map.zoomOut()}
        aria-label="Alejar"
        title="Alejar"
        onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#f0f4ff')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fff')}
      >
        −
      </button>
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
}

export default function MapView({
  lat,
  lng,
  categoria,
  savedPins,
  onPositionChange,
  onGPSStatus,
  onDeletePin,
}: MapViewProps) {
  const hasValidPosition = lat !== 0 || lng !== 0

  const handleDragEnd = useCallback(
    (e: L.DragEndEvent) => {
      const pos = (e.target as L.Marker).getLatLng()
      onPositionChange(pos.lat, pos.lng)
    },
    [onPositionChange],
  )

  // Default center: Caracas, Venezuela
  const defaultCenter: [number, number] = hasValidPosition ? [lat, lng] : [10.4806, -66.9036]

  return (
    <MapContainer
      center={defaultCenter}
      zoom={hasValidPosition ? 16 : 6}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
      scrollWheelZoom
    >
      <LayersControl position="topright" collapsed={false}>
        <LayersControl.BaseLayer checked name="Mapa estándar">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Mapa topográfico (relieve)">
          <TileLayer
            attribution='Kartendaten: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, SRTM | Kartendarstellung: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxNativeZoom={17}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <GPSDetector onPositionChange={onPositionChange} onGPSStatus={onGPSStatus} />
      <MapClickHandler onPositionChange={onPositionChange} />
      <MapActionControls onPositionChange={onPositionChange} onGPSStatus={onGPSStatus} />

      {/* Active / draggable marker */}
      {hasValidPosition && (
        <Marker
          position={[lat, lng]}
          draggable
          icon={createDraggableIcon(categoria)}
          eventHandlers={{ dragend: handleDragEnd }}
        >
          <Popup>
            <div style={{ minWidth: 140 }}>
              <p style={{ fontWeight: 600, marginBottom: 4, fontSize: 13 }}>Posicion actual</p>
              <p style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
                {lat.toFixed(6)},{' '}
                {lng.toFixed(6)}
              </p>
              <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                Arrastra para mover o haz clic en el mapa
              </p>
            </div>
          </Popup>
        </Marker>
      )}

      {/* Saved pins */}
      {savedPins.map((pin) => {
        const cat = CATEGORIAS[pin.categoria]
        const urbanDetails = getUrbanDetails(pin)
        return (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={createCategoryIcon(pin.categoria)}
          >
            <Popup>
              <div style={{ minWidth: 180, maxWidth: 220 }}>
                <span
                  style={{
                    display: 'inline-block',
                    backgroundColor: cat.bgColor,
                    color: cat.color,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  {cat.label}
                </span>
                <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 4px' }}>{pin.nombre}</p>
                {pin.descripcion && (
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px' }}>
                    {pin.descripcion}
                  </p>
                )}
                {urbanDetails.length > 0 && (
                  <dl
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1fr) auto',
                      gap: '3px 8px',
                      fontSize: 11,
                      margin: '8px 0',
                      maxHeight: 180,
                      overflowY: 'auto',
                    }}
                  >
                    {urbanDetails.map((detail) => (
                      <div key={detail.label} style={{ display: 'contents' }}>
                        <dt style={{ color: '#64748b' }}>{detail.label}</dt>
                        <dd style={{ color: '#1e293b', fontWeight: 600, margin: 0, textAlign: 'right' }}>
                          {detail.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', margin: '0 0 8px' }}>
                  {pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}
                </p>
                <button
                  type="button"
                  onClick={() => onDeletePin(pin.id)}
                  aria-label={`Eliminar ${pin.nombre}`}
                  style={{
                    background: '#fee2e2',
                    color: '#dc2626',
                    border: 'none',
                    borderRadius: 4,
                    padding: '4px 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Eliminar
                </button>
              </div>
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
