/**
 * Fuentes de tiles del mapa.
 *
 * La fuente "propia" es la que se puede descargar para uso offline: sale del
 * blob storage, así que la app puede pedirle lo que quiera sin violar la
 * política de uso de teselas de nadie.
 *
 * La política de uso de OpenStreetMap **prohíbe** el uso offline y el
 * prefetch contra `tile.openstreetmap.org`. Lo que sí permite es cachear
 * mientras el usuario navega por el viewport, que es exactamente lo que hace
 * la regla de cache del service worker.
 */

export interface TileSource {
  id: string
  label: string
  /** Plantilla XYZ. Los tiles se piden siempre en orden z/x/y. */
  url: string
  attribution: string
  minZoom: number
  maxZoom: number
  /**
   * Las fuentes propias se pueden precachear: el contenido es inmutable y
   * nadie más tiene que pagar el bandwidth.
   */
  propio: boolean
}

/**
 * Base de los tiles propios. La define `NEXT_PUBLIC_TILE_BASE_URL` porque la
 * necesita el cliente para construir las URLs.
 */
export const TILE_BASE_URL = (process.env.NEXT_PUBLIC_TILE_BASE_URL ?? '').replace(/\/$/, '')

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/**
 * Zoom hasta el que se precachea el área del levantamiento.
 *
 * Un tile z16 mide unos 600 m y uno z18 unos 150 m. Cubrir un área de
 * 10 × 10 km con z17 y z18 son miles de teselas — del orden de 150 MB—, y
 * eso no es razonable para una app de campo sobre datos móviles. El
 * precacheo se detiene en z16, que da el mapa base para orientarse, y los
 * niveles finos se van llenando a medida que el surveyor navega.
 */
export const PREFETCH_MIN_ZOOM = 12
export const PREFETCH_MAX_ZOOM = 16

export const TILE_SOURCES: TileSource[] = [
  {
    id: 'propio',
    label: 'Mapa del levantamiento',
    url: TILE_BASE_URL ? `${TILE_BASE_URL}/{z}/{x}/{y}.png` : '',
    attribution: 'Levantamiento propio',
    minZoom: 12,
    maxZoom: 18,
    propio: true,
  },
  {
    id: 'osm',
    label: 'Mapa estándar',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTRIBUTION,
    minZoom: 0,
    maxZoom: 19,
    propio: false,
  },
  {
    id: 'topo',
    label: 'Mapa topográfico (relieve)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution:
      'Kartendaten: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, SRTM | Kartendarstellung: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
    minZoom: 0,
    maxZoom: 17,
    propio: false,
  },
]

/** Devuelve la fuente por id, o `null` si no existe. */
export function getTileSource(id: string): TileSource | null {
  return TILE_SOURCES.find((source) => source.id === id) ?? null
}

/**
 * ¿Hay una fuente propia configurada?
 *
 * Sin `NEXT_PUBLIC_TILE_BASE_URL` no hay mapa offline: el botón de descarga
 * tiene que avisarlo en lugar de fallar en silencio.
 */
export function hasOwnTileSource(): boolean {
  return TILE_SOURCES.some((source) => source.propio && source.url !== '')
}

/**
 * Expande la plantilla de una URL de tiles.
 *
 * Las plantillas usan `{s}` para el subdominio y `{z}`, `{x}`, `{y}` para la
 * posición. Se expanden acá para que el service worker pueda comparar URLs
 * sin depender de la sintaxis de Leaflet.
 */
export function expandTileUrl(template: string, z: number, x: number, y: number): string {
  const subdomains = ['a', 'b', 'c']
  const subdomain = subdomains[Math.abs(x + y) % subdomains.length] ?? 'a'
  return template
    .replace('{s}', subdomain)
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
}
