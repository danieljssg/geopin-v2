import { tilesForBounds, type Bounds, type TileCoordinate } from './tiles'

/**
 * Descarga del mapa de un área al caché del service worker.
 *
 * La app de campo necesita el mapa disponible sin señal. Los tiles se piden
 * a la fuente propia —la del blob storage— y se guardan en el mismo
 * `CacheStorage` que lee el service worker, así que no hace falta un
 * service worker activo para que el mapa funcione sin red.
 *
 * La lógica va aparte del `CacheStorage` real para poder probarla: el
 * caché se inyecta.
 */

export interface CacheMinimo {
  put(request: Request, response: Response): Promise<void>
}

/**
 * Nombre del caché de tiles propios.
 *
 * Lo usan el service worker —que lo lee para responder sin red— y la app de
 * campo —que lo llena con la descarga del área—. Si los dos nombres
 * difieren, la descarga no sirve de nada.
 */
export const CACHE_TILES_PROPIOS = 'geopin-tiles-propios-v1'

/** Plantilla de la fuente de tiles propia. */
export const TILE_BASE_PLANTILLA = '/tiles/{z}/{x}/{y}.png'

export interface OpcionesPrefetch {
  tiles: readonly TileCoordinate[]
  /** Base de la URL de los tiles, sin barra final. */
  baseUrl: string
  cache: CacheMinimo
  fetchImpl?: typeof fetch
  /** Cuántos tiles se piden a la vez. */
  concurrencia?: number
  onProgress?: (hechos: number, total: number) => void
  onError?: (mensaje: string, tile: TileCoordinate) => void
}

export interface ResultadoPrefetch {
  descargados: number
  fallidos: number
  total: number
  errores: Array<{ tile: TileCoordinate; mensaje: string }>
}

/** URL de un tile en la fuente propia. */
export function urlDeTile(baseUrl: string, tile: TileCoordinate): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/${tile.z}/${tile.x}/${tile.y}.png`
}

/**
 * Resuelve una URL relativa contra el origen de la página.
 *
 * No es cosmético: la clave con la que se guarda un tile en el `CacheStorage`
 * es la URL **absoluta** del `Request`, que es exactamente la que usa el
 * service worker al buscar. Si se guardara con la URL relativa, el service
 * worker no encontraría nunca los tiles y el mapa no funcionaría offline.
 */
export function urlAbsoluta(url: string): string {
  const origen =
    typeof location !== 'undefined' && location.origin ? location.origin : 'http://localhost'
  return new URL(url, origen).toString()
}

/**
 * Descarga los tiles al caché.
 *
 * No corta ante el primer error: un tile que falla no puede impedir que se
 * descarguen los demás. Al final informa cuántos quedaron sin bajar, que es
 * lo que la interfaz le muestra al levantador.
 */
export async function descargarTiles(opciones: OpcionesPrefetch): Promise<ResultadoPrefetch> {
  const {
    tiles,
    baseUrl,
    cache,
    fetchImpl = globalThis.fetch,
    concurrencia = 6,
    onProgress,
    onError,
  } = opciones

  const errores: Array<{ tile: TileCoordinate; mensaje: string }> = []
  let descargados = 0
  let fallidos = 0
  let hechos = 0

  const total = tiles.length

  const descargarUno = async (tile: TileCoordinate): Promise<void> => {
    const url = urlDeTile(baseUrl, tile)

    try {
      const respuesta = await fetchImpl(url, { cache: 'no-cache' })

      if (!respuesta.ok) {
        throw new Error(`El servidor respondió ${respuesta.status}.`)
      }

      await cache.put(new Request(urlAbsoluta(url)), respuesta.clone())
      descargados += 1
    } catch (error) {
      fallidos += 1
      const mensaje = error instanceof Error ? error.message : 'Error desconocido.'
      errores.push({ tile, mensaje })
      onError?.(mensaje, tile)
    } finally {
      hechos += 1
      onProgress?.(hechos, total)
    }
  }

  // Se avanza de a `concurrencia` tiles, sin dejar la promesa colgando.
  const cola = [...tiles]
  const trabajadores = Array.from({ length: Math.min(concurrencia, cola.length) }, async () => {
    while (cola.length > 0) {
      const tile = cola.shift()
      if (!tile) return
      await descargarUno(tile)
    }
  })

  await Promise.all(trabajadores)

  return { descargados, fallidos, total, errores }
}

/**
 * Los tiles que hay que bajar para tener el mapa de un área.
 *
 * El rango por defecto es z12 a z16: es el mapa base con el que el
 * levantador se orienta. Los niveles finos se van llenando a medida que
 * navega, porque prefetchearlos son unos 150 MB.
 */
export const PREFETCH_MIN_ZOOM = 12
export const PREFETCH_MAX_ZOOM = 16

export interface OpcionesArea {
  bounds: Bounds
  minZoom?: number
  maxZoom?: number
}

export function tilesDelArea(opciones: OpcionesArea): TileCoordinate[] {
  const minZoom = opciones.minZoom ?? PREFETCH_MIN_ZOOM
  const maxZoom = opciones.maxZoom ?? PREFETCH_MAX_ZOOM
  return tilesForBounds(opciones.bounds, minZoom, maxZoom)
}

/** Volumen aproximado del área, en bytes. */
export function estimarVolumen(tiles: readonly TileCoordinate[], bytesPorTile = 20_000): number {
  return tiles.length * bytesPorTile
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
