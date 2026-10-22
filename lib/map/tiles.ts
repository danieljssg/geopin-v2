/**
 * Matemática de teselas en el esquema "slippy map" (XYZ).
 *
 * Todo es puro y sin dependencias: la lista de teselas que cubre un área se
 * calcula en el cliente para decidir qué descargar, y en el servidor para
 * generar la pirámide. La misma función en los dos lados garantiza que el
 * botón "descargar mapa" y la pirámide generada coincidan.
 */

export interface Bounds {
  north: number
  south: number
  east: number
  west: number
}

export interface TileCoordinate {
  z: number
  x: number
  y: number
}

/** Latitud máxima que representa el esquema de teselas. */
export const MAX_LATITUDE = 85.05112878

/** Número de teselas por lado en un nivel de zoom. */
export function tilesPerAxis(zoom: number): number {
  return 2 ** zoom
}

/** Longitud → columna de tesela. */
export function lonToTileX(lon: number, zoom: number): number {
  const n = tilesPerAxis(zoom)
  const x = Math.floor(((lon + 180) / 360) * n)
  return Math.min(Math.max(x, 0), n - 1)
}

/** Latitud → fila de tesela. */
export function latToTileY(lat: number, zoom: number): number {
  const n = tilesPerAxis(zoom)
  const limited = Math.min(Math.max(lat, -MAX_LATITUDE), MAX_LATITUDE)
  const rad = (limited * Math.PI) / 180
  const y = Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  )
  return Math.min(Math.max(y, 0), n - 1)
}

/** Esquina noroccidental de una tesela, en grados. */
export function tileToLon(x: number, z: number): number {
  return (x / tilesPerAxis(z)) * 360 - 180
}

export function tileToLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / tilesPerAxis(z)
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

/**
 * Lista de teselas que cubren un área, del zoom mínimo al máximo.
 *
 * Se recorre de menor a mayor zoom para que la descarga pueda empezar por lo
 * más grueso: si el área es grande, el usuario ve el mapa útil antes de que
 * termine la descarga fina.
 */
export function tilesForBounds(
  bounds: Bounds,
  minZoom: number,
  maxZoom: number,
): TileCoordinate[] {
  const tiles: TileCoordinate[] = []

  for (let z = minZoom; z <= maxZoom; z += 1) {
    const minX = lonToTileX(bounds.west, z)
    const maxX = lonToTileX(bounds.east, z)
    const minY = latToTileY(bounds.north, z)
    const maxY = latToTileY(bounds.south, z)

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        tiles.push({ z, x, y })
      }
    }
  }

  return tiles
}

/** Cuántas teselas cubre un área. */
export function countTilesForBounds(
  bounds: Bounds,
  minZoom: number,
  maxZoom: number,
): number {
  let total = 0
  for (let z = minZoom; z <= maxZoom; z += 1) {
    const minX = lonToTileX(bounds.west, z)
    const maxX = lonToTileX(bounds.east, z)
    const minY = latToTileY(bounds.north, z)
    const maxY = latToTileY(bounds.south, z)
    total += (maxX - minX + 1) * (maxY - minY + 1)
  }
  return total
}

/**
 * Caja envolvente de un conjunto de coordenadas, con un margen en metros.
 *
 * El margen evita que la descarga de un área deje las teselas del borde
 * justo en el límite, que es donde el surveyor se va a parar.
 */
export function boundsFromPoints(
  points: { lat: number; lng: number }[],
  marginMetres = 250,
): Bounds | null {
  if (points.length === 0) return null

  let north = -90
  let south = 90
  let west = 180
  let east = -180

  for (const point of points) {
    north = Math.max(north, point.lat)
    south = Math.min(south, point.lat)
    west = Math.min(west, point.lng)
    east = Math.max(east, point.lng)
  }

  const metresPerDegreeLat = 111_132.92
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((north * Math.PI) / 180)
  const marginLat = marginMetres / metresPerDegreeLat
  const marginLng = marginMetres / (metresPerDegreeLng || 1)

  return {
    north: Math.min(north + marginLat, MAX_LATITUDE),
    south: Math.max(south - marginLat, -MAX_LATITUDE),
    east: Math.min(east + marginLng, 180),
    west: Math.max(west - marginLng, -180),
  }
}
