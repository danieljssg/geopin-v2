'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useMap } from 'react-leaflet'
import type { CapaMapa } from '@/lib/map/capas'

/**
 * Superposición sobre el mapa: una ortofoto WMS o una capa WMTS.
 *
 * Se agrega al mapa de forma imperativa porque `react-leaflet` v5 no tiene
 * componente para WMS: sus opciones (`layers`, `transparent`) no existen en
 * `TileLayerOptions`.
 *
 * La opacidad se cambia **sin recrear la capa**: al recrearla, laLeaflet
 * vuelve a pedir las teselas al servidor y el mapa parpadea en cada
 * movimiento del deslizador.
 */
export default function CapaSuperpuesta({
  capa,
  opacidad,
}: {
  capa: CapaMapa
  opacidad: number
}) {
  const map = useMap()
  const referencia = useRef<L.TileLayer | null>(null)

  useEffect(() => {
    // La opacidad inicial es la de la capa; los cambios posteriores se
    // aplican con setOpacity, sin recrearla.
    const opacidadInicial = opacidad

    const layer = capa.wmsLayers
      ? L.tileLayer.wms(capa.url, {
          layers: capa.wmsLayers,
          transparent: true,
          opacity: opacidadInicial,
          attribution: capa.attribution,
          maxZoom: 22,
        })
      : L.tileLayer(capa.url, {
          opacity: opacidadInicial,
          attribution: capa.attribution,
          maxZoom: 22,
        })

    layer.addTo(map)
    referencia.current = layer

    return () => {
      map.removeLayer(layer)
      referencia.current = null
    }
    // La opacidad se actualiza en el efecto de abajo, no acá: si fuera
    // dependencia, cada movimiento del deslizador recrearía la capa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, capa.url, capa.wmsLayers, capa.attribution])

  useEffect(() => {
    referencia.current?.setOpacity(opacidad)
  }, [opacidad])

  return null
}
