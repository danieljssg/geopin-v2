'use client'

import { Circle, CircleMarker, LayersControl, MapContainer, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { DensidadCelda } from '@/lib/domain/dashboard'
import type { ParcelaEstado } from '@/lib/domain/types'

/**
 * Mapa del dashboard: calor de densidad más capas de completadas y
 * pendientes.
 *
 * El calor no usa un plugin de heatmap: con el levantamiento de una ciudad
 * son unos cientos de puntos, y agruparlos en celdas de manzana y dibujar un
 * círculo por celda cuyo radio y opacidad dependen del conteo se lee igual de
 * bien sin sumar una dependencia.
 */

export interface PuntoMapa {
  id: string
  nombre: string
  estado: ParcelaEstado
  lat: number
  lng: number
}

export interface MapaCalorProps {
  celdas: DensidadCelda[]
  puntos: PuntoMapa[]
  centro?: [number, number]
}

const COLOR_ESTADO: Record<ParcelaEstado, string> = {
  completa: '#16a34a',
  pendiente: '#ea580c',
  en_revision: '#2563eb',
}

const ETIQUETA_ESTADO: Record<ParcelaEstado, string> = {
  completa: 'Completada',
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
}

export default function MapaCalor({ celdas, puntos, centro }: MapaCalorProps) {
  const centroMapa: [number, number] =
    centro ??
    (puntos.length > 0
      ? [
          puntos.reduce((suma, p) => suma + p.lat, 0) / puntos.length,
          puntos.reduce((suma, p) => suma + p.lng, 0) / puntos.length,
        ]
      : [10.4806, -66.9036])

  const maximo = celdas.reduce((max, celda) => Math.max(max, celda.count), 1)

  return (
    <MapContainer
      center={centroMapa}
      zoom={puntos.length > 0 ? 13 : 6}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <LayersControl position="topright">
        <LayersControl.Overlay checked name="Densidad">
          <>
            {celdas.map((celda, indice) => {
              const intensidad = celda.count / maximo
              return (
                <Circle
                  key={`celda-${indice}`}
                  center={[celda.lat, celda.lng]}
                  radius={60 + intensidad * 180}
                  pathOptions={{
                    color: '#dc2626',
                    weight: 0,
                    fillColor: '#ef4444',
                    fillOpacity: 0.12 + intensidad * 0.35,
                  }}
                >
                  <Popup>{celda.count} parcelas en esta celda</Popup>
                </Circle>
              )
            })}
          </>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Completadas">
          <>
            {puntos
              .filter((punto) => punto.estado === 'completa')
              .map((punto) => (
                <CircleMarker
                  key={punto.id}
                  center={[punto.lat, punto.lng]}
                  radius={5}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 1.5,
                    fillColor: COLOR_ESTADO.completa,
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <strong>{punto.nombre}</strong>
                    <br />
                    {ETIQUETA_ESTADO[punto.estado]}
                  </Popup>
                </CircleMarker>
              ))}
          </>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Pendientes">
          <>
            {puntos
              .filter((punto) => punto.estado !== 'completa')
              .map((punto) => (
                <CircleMarker
                  key={punto.id}
                  center={[punto.lat, punto.lng]}
                  radius={5}
                  pathOptions={{
                    color: '#ffffff',
                    weight: 1.5,
                    fillColor: COLOR_ESTADO[punto.estado],
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <strong>{punto.nombre}</strong>
                    <br />
                    {ETIQUETA_ESTADO[punto.estado]}
                  </Popup>
                </CircleMarker>
              ))}
          </>
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  )
}
