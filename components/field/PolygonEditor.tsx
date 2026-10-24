'use client'

import L from 'leaflet'
import { CircleMarker, Marker, Polygon, Polyline, useMapEvents } from 'react-leaflet'
import type { Draft, DraftVertex } from '@/lib/domain/polygon-draft'
import type { GeoPolygon } from '@/lib/domain/types'

/**
 * Trazado del polígono sobre el mapa.
 *
 * Mientras se dibuja, cada toque agrega un vértice. Los vértices son
 * arrastrables para corregir la posición y se pueden tocar para quitarlos.
 * El contorno se dibuja punteado hasta que se cierra.
 *
 * Se implementa sobre `react-leaflet` y no sobre `leaflet-draw`: ese plugin
 * es de 2018, su interfaz es de escritorio y no tiene deshacer. Acá hacen
 * falta objetivos táctiles grandes, edición de vértices y deshacer.
 */

export interface PolygonEditorProps {
  /** Borrador en curso. */
  draft: Draft
  /** Polígono ya cerrado, si lo hay. */
  geometria: GeoPolygon | null
  /** Si es `true`, los toques agregan vértices. */
  trazando: boolean
  onAgregar: (vertice: DraftVertex) => void
  onMover: (indice: number, vertice: DraftVertex) => void
  onQuitar: (indice: number) => void
}

function vertexIcon(): L.DivIcon {
  return L.divIcon({
    html: `
      <div style="
        width:26px;height:26px;border-radius:50%;
        background:#1d4ed8;border:3px solid #fff;
        box-shadow:0 1px 6px rgba(0,0,0,.4);
        display:flex;align-items:center;justify-content:center;
        color:#fff;font-size:11px;font-weight:700;
        font-family:ui-sans-serif,system-ui,sans-serif;
      ">×</div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

export default function PolygonEditor({
  draft,
  geometria,
  trazando,
  onAgregar,
  onMover,
  onQuitar,
}: PolygonEditorProps) {
  useMapEvents({
    click(event) {
      if (!trazando) return
      onAgregar({ lng: event.latlng.lng, lat: event.latlng.lat })
    },
  })

  const posicionesBorrador = draft.map((vertice) => [vertice.lat, vertice.lng] as [number, number])

  return (
    <>
      {/* Polígono cerrado: línea continua, relleno suave. */}
      {geometria && (
        <Polygon
          positions={geometria.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])}
          pathOptions={{ color: '#15803d', weight: 2, fillOpacity: 0.15, fillColor: '#22c55e' }}
        />
      )}

      {/* Contorno en curso: línea punteada. */}
      {posicionesBorrador.length >= 2 && (
        <Polyline
          positions={posicionesBorrador}
          pathOptions={{ color: '#1d4ed8', weight: 2, dashArray: '6 6' }}
        />
      )}

      {/* Si el borrador tiene tres o más, se muestra el área implícita. */}
      {posicionesBorrador.length >= 3 && (
        <Polygon
          positions={posicionesBorrador}
          pathOptions={{ color: '#1d4ed8', weight: 1, fillOpacity: 0.08, fillColor: '#3b82f6' }}
        />
      )}

      {/* Vértices: arrastrables y con un toque para quitarlos. */}
      {draft.map((vertice, indice) => (
        <Marker
          key={`vertice-${indice}-${vertice.lng.toFixed(7)}-${vertice.lat.toFixed(7)}`}
          position={[vertice.lat, vertice.lng]}
          icon={vertexIcon()}
          draggable
          eventHandlers={{
            dragend: (event) => {
              const posicion = (event.target as L.Marker).getLatLng()
              onMover(indice, { lng: posicion.lng, lat: posicion.lat })
            },
            click: () => {
              onQuitar(indice)
            },
          }}
        />
      ))}

      {/* Punto de partida, para que se vea dónde cerrar. */}
      {draft.length >= 3 && (
        <CircleMarker
          center={[draft[0].lat, draft[0].lng]}
          radius={9}
          pathOptions={{ color: '#15803d', weight: 3, fillColor: '#22c55e', fillOpacity: 0.4 }}
        />
      )}
    </>
  )
}
