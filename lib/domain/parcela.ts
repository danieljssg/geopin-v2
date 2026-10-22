import type { GeoPoint, Parcela } from './types'
import type { UbicacionInput } from '@/lib/api/contracts'

/**
 * Conversiones entre el formato de la API y el documento de dominio.
 *
 * GeoJSON exige el orden `[longitud, latitud]` (RFC 7946) y la API expone
 * `lat`/`lng` en el orden en que se leen. La conversión vive acá, en un
 * módulo puro, para que el error de orden no se disperse por el código.
 */

/** Convierte `{lat, lng}` en un punto GeoJSON. */
export function toGeoPoint(ubicacion: UbicacionInput): GeoPoint {
  return {
    type: 'Point',
    coordinates: [ubicacion.lng, ubicacion.lat],
  }
}

/** Convierte un punto GeoJSON en `{lat, lng}`. */
export function fromGeoPoint(point: GeoPoint): UbicacionInput {
  return { lng: point.coordinates[0], lat: point.coordinates[1] }
}

/**
 * Calcula el área en metros cuadrados de un polígono usando la fórmula del
 * trapecio sobre la proyección equirectangular.
 *
 * Es la misma fórmula que usa turf con la opción `planimetric` aproximada
 * para áreas pequeñas: a escala de parcela (decenas de metros) el error es
 * despreciable y no hace falta proyectar a un sistema de referencia local.
 */
export function polygonAreaM2(coordinates: number[][][]): number {
  const ring = coordinates[0]
  if (!ring || ring.length < 4) return 0

  const latRad = (deg: number) => (deg * Math.PI) / 180
  const metresPerDegreeLat = 111_132.92
  const meanLat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos(latRad(meanLat))

  let area = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[i + 1]
    area += x1 * metresPerDegreeLng * (y2 * metresPerDegreeLat)
    area -= x2 * metresPerDegreeLng * (y1 * metresPerDegreeLat)
  }

  return Math.abs(area / 2)
}

/** Calcula el perímetro en metros de un polígono. */
export function polygonPerimeterM(coordinates: number[][][]): number {
  const ring = coordinates[0]
  if (!ring || ring.length < 4) return 0

  const metresPerDegreeLat = 111_132.92
  const meanLat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length
  const metresPerDegreeLng = metresPerDegreeLat * Math.cos((meanLat * Math.PI) / 180)

  let perimeter = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    const dx = (ring[i + 1][0] - ring[i][0]) * metresPerDegreeLng
    const dy = (ring[i + 1][1] - ring[i][1]) * metresPerDegreeLat
    perimeter += Math.sqrt(dx * dx + dy * dy)
  }

  return perimeter
}

/** ¿El polígono tiene forma utilizable? */
export function isUsablePolygon(coordinates: number[][][] | undefined): boolean {
  if (!coordinates || coordinates.length === 0) return false
  const ring = coordinates[0]
  if (!ring || ring.length < 4) return false
  return ring.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]),
  )
}

/** Estado por defecto de una parcela recién capturada. */
export const DEFAULT_PARCELA_ESTADO: Parcela['estado'] = 'pendiente'
