'use client'

import { useCallback, useRef, useState } from 'react'
import {
  CACHE_TILES_PROPIOS,
  descargarTiles,
  estimarVolumen,
  formatearBytes,
  tilesDelArea,
  type ResultadoPrefetch,
} from '@/lib/map/prefetch'
import type { Bounds } from '@/lib/map/tiles'

/**
 * Descarga del mapa de un área al dispositivo.
 *
 * Es lo que hace que el mapa funcione sin cobertura: los tiles del área se
 * guardan en el mismo caché que lee el service worker, así que al volver a
 * abrir la app en el mismo lugar el mapa aparece aunque no haya señal.
 */

export interface UseDescargarMapaResult {
  descargando: boolean
  hechos: number
  total: number
  resultado: ResultadoPrefetch | null
  error?: string
  descargar: (bounds: Bounds) => Promise<void>
  cancelar: () => void
}

export function useDescargarMapa(): UseDescargarMapaResult {
  const [descargando, setDescargando] = useState(false)
  const [hechos, setHechos] = useState(0)
  const [total, setTotal] = useState(0)
  const [resultado, setResultado] = useState<ResultadoPrefetch | null>(null)
  const [error, setError] = useState<string | undefined>()

  // La cancelación va en un ref: si fuera estado, cada cambio recrearía la
  // función de descarga y la volvería a registrar en el padre.
  const cancelado = useRef(false)

  const descargar = useCallback(async (bounds: Bounds) => {
    setDescargando(true)
    setError(undefined)
    setResultado(null)
    setHechos(0)
    cancelado.current = false

    try {
      if (typeof caches === 'undefined') {
        throw new Error('Este navegador no permite guardar el mapa sin conexión.')
      }

      const tiles = tilesDelArea({ bounds })
      const cache = await caches.open(CACHE_TILES_PROPIOS)

      setTotal(tiles.length)

      const resumen = await descargarTiles({
        tiles,
        baseUrl: process.env.NEXT_PUBLIC_TILE_BASE_URL ?? '/tiles',
        cache,
        onProgress: (hechosHechos) => {
          if (!cancelado.current) setHechos(hechosHechos)
        },
      })

      setResultado(resumen)
      setHechos(resumen.total)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo descargar el mapa.')
    } finally {
      setDescargando(false)
    }
  }, [])

  const cancelar = useCallback(() => {
    cancelado.current = true
  }, [])

  return { descargando, hechos, total, resultado, error, descargar, cancelar }
}

/** Volumen estimado de un área, para mostrarlo antes de descargar. */
export function estimarArea(bounds: Bounds): { tiles: number; bytes: number } {
  const tiles = tilesDelArea({ bounds })
  return { tiles: tiles.length, bytes: estimarVolumen(tiles) }
}

export { formatearBytes }
