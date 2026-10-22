import type { GeoPolygon, ParcelaEstado } from '@/lib/domain/types'

/**
 * Contrato de la API de parcelas.
 *
 * Los tipos y los validadores viven juntos y son puros: el servidor valida
 * con estas mismas funciones y el cliente de campo (T5) construye las
 * peticiones con los mismos tipos. Una sola definición de lo que es una
 * petición válida.
 */

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

export interface UbicacionInput {
  lat: number
  lng: number
}

export interface GpsInput {
  fuente: 'sensor' | 'manual'
  precision?: number
}

export interface ParcelaCoreInput {
  nombre: string
  descripcion: string
  categoria: string
  codigo?: string
  ubicacion: UbicacionInput
  gps: GpsInput
  estado: ParcelaEstado
  levantamientoId?: string
  geometria?: GeoPolygon
  areaM2?: number
  perimetroM?: number
}

export interface ModuloUpdateInput {
  moduleId: string
  baseVersion: number
  schemaVersion: number
  datos: Record<string, unknown>
}

export interface ParcelaCreateRequest extends ParcelaCoreInput {
  /** Id generado por el cliente. Es la clave de idempotencia del sync. */
  id: string
  modulos?: ModuloUpdateInput[]
}

export interface ParcelaPatchRequest {
  core?: Partial<ParcelaCoreInput>
  modulos?: ModuloUpdateInput[]
}

export interface SyncRequest {
  parcels: ParcelaCreateRequest[]
}

export type ParcelaEstadoSync = 'creado' | 'actualizado' | 'ignorado' | 'conflicto' | 'error'

export interface SyncItemResult {
  id: string
  estado: ParcelaEstadoSync
  resultados?: Record<string, string>
  conflictos?: unknown[]
  error?: string
}

export interface SyncResponse {
  resultados: SyncItemResult[]
}

export interface ParcelasListResponse {
  parcelas: unknown[]
  total: number
  limite: number
  skip: number
}

/** Máximo de parcelas por tanda de sync. */
export const MAX_SYNC_BATCH = 100

/** Máximo de parcelas por página en el listado. */
export const MAX_LIST_LIMIT = 200

const MAX_NOMBRE = 200
const MAX_DESCRIPCION = 20_000
const MAX_CATEGORIA = 60
const MAX_CODIGO = 60
const MAX_MODULE_ID = 80

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = source[key]
  if (typeof value !== 'string') return { ok: false, error: `Falta "${key}" o no es texto.` }
  const trimmed = value.trim()
  if (trimmed === '') return { ok: false, error: `"${key}" no puede estar vacío.` }
  if (trimmed.length > maxLength) {
    return { ok: false, error: `"${key}" no puede superar ${maxLength} caracteres.` }
  }
  return { ok: true, value: trimmed }
}

function optionalString(
  source: Record<string, unknown>,
  key: string,
  maxLength: number,
): { ok: true; value?: string } | { ok: false; error: string } {
  const value = source[key]
  if (value === undefined || value === null) return { ok: true }
  if (typeof value !== 'string') return { ok: false, error: `"${key}" debe ser texto.` }
  const trimmed = value.trim()
  if (trimmed === '') return { ok: true }
  if (trimmed.length > maxLength) {
    return { ok: false, error: `"${key}" no puede superar ${maxLength} caracteres.` }
  }
  return { ok: true, value: trimmed }
}

function optionalNumber(
  source: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number } = {},
): { ok: true; value?: number } | { ok: false; error: string } {
  const value = source[key]
  if (value === undefined || value === null) return { ok: true }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { ok: false, error: `"${key}" debe ser un número.` }
  }
  if (options.min !== undefined && value < options.min) {
    return { ok: false, error: `"${key}" no puede ser menor que ${options.min}.` }
  }
  if (options.max !== undefined && value > options.max) {
    return { ok: false, error: `"${key}" no puede ser mayor que ${options.max}.` }
  }
  return { ok: true, value }
}

function requiredNumber(
  source: Record<string, unknown>,
  key: string,
  options: { min?: number; max?: number } = {},
): { ok: true; value: number } | { ok: false; error: string } {
  const parsed = optionalNumber(source, key, options)
  if (!parsed.ok) return parsed
  if (parsed.value === undefined) return { ok: false, error: `Falta "${key}".` }
  return { ok: true, value: parsed.value }
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function parseUbicacion(value: unknown): ParseResult<UbicacionInput> {
  if (!isRecord(value)) return { ok: false, error: '"ubicacion" debe ser un objeto.' }

  const lat = requiredNumber(value, 'lat', { min: -90, max: 90 })
  if (!lat.ok) return lat

  const lng = requiredNumber(value, 'lng', { min: -180, max: 180 })
  if (!lng.ok) return lng

  return { ok: true, value: { lat: lat.value, lng: lng.value } }
}

function parseGps(value: unknown): ParseResult<GpsInput> {
  if (!isRecord(value)) return { ok: false, error: '"gps" debe ser un objeto.' }

  const fuente = value.fuente
  if (fuente !== 'sensor' && fuente !== 'manual') {
    return { ok: false, error: '"gps.fuente" debe ser "sensor" o "manual".' }
  }

  const precision = optionalNumber(value, 'precision', { min: 0 })
  if (!precision.ok) return precision

  return {
    ok: true,
    value: precision.value === undefined ? { fuente } : { fuente, precision: precision.value },
  }
}

function parseGeometria(value: unknown): ParseResult<GeoPolygon | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined }

  if (!isRecord(value) || value.type !== 'Polygon') {
    return { ok: false, error: '"geometria" debe ser un GeoJSON Polygon.' }
  }

  const coordinates = value.coordinates
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return { ok: false, error: '"geometria.coordinates" debe tener al menos un anillo.' }
  }

  for (const ring of coordinates) {
    if (!Array.isArray(ring) || ring.length < 4) {
      return { ok: false, error: 'Cada anillo de la geometría debe tener al menos 4 vértices.' }
    }
    for (const point of ring) {
      if (
        !Array.isArray(point) ||
        point.length !== 2 ||
        typeof point[0] !== 'number' ||
        typeof point[1] !== 'number'
      ) {
        return { ok: false, error: 'Cada vértice debe ser un par [longitud, latitud].' }
      }
    }
  }

  return { ok: true, value: { type: 'Polygon', coordinates: coordinates as number[][][] } }
}

function parseEstado(value: unknown): ParseResult<ParcelaEstado> {
  if (value === undefined || value === null) return { ok: true, value: 'pendiente' }
  if (value === 'pendiente' || value === 'completa' || value === 'en_revision') {
    return { ok: true, value }
  }
  return { ok: false, error: '"estado" debe ser pendiente, completa o en_revision.' }
}

function parseModuloUpdate(value: unknown): ParseResult<ModuloUpdateInput> {
  if (!isRecord(value)) return { ok: false, error: 'Cada módulo debe ser un objeto.' }

  const moduleId = requiredString(value, 'moduleId', MAX_MODULE_ID)
  if (!moduleId.ok) return moduleId

  const baseVersion = requiredNumber(value, 'baseVersion', { min: 0 })
  if (!baseVersion.ok) return baseVersion

  const schemaVersion = requiredNumber(value, 'schemaVersion', { min: 0 })
  if (!schemaVersion.ok) return schemaVersion

  const datos = value.datos
  if (!isRecord(datos)) return { ok: false, error: `"datos" de ${moduleId.value} debe ser un objeto.` }

  return {
    ok: true,
    value: {
      moduleId: moduleId.value,
      baseVersion: baseVersion.value,
      schemaVersion: schemaVersion.value,
      datos,
    },
  }
}

function parseModuloUpdates(value: unknown): ParseResult<ModuloUpdateInput[]> {
  if (value === undefined || value === null) return { ok: true, value: [] }
  if (!Array.isArray(value)) return { ok: false, error: '"modulos" debe ser una lista.' }

  const updates: ModuloUpdateInput[] = []
  for (const item of value) {
    const parsed = parseModuloUpdate(item)
    if (!parsed.ok) return parsed
    updates.push(parsed.value)
  }

  return { ok: true, value: updates }
}

function parseCore(
  source: Record<string, unknown>,
  { requireAll }: { requireAll: boolean },
): ParseResult<ParcelaCoreInput> {
  const partial: Partial<ParcelaCoreInput> = {}
  const present = (key: string) => source[key] !== undefined && source[key] !== null

  if (present('nombre')) {
    const nombre = requiredString(source, 'nombre', MAX_NOMBRE)
    if (!nombre.ok) return nombre
    partial.nombre = nombre.value
  } else if (requireAll) {
    return { ok: false, error: 'Falta "nombre".' }
  }

  if (present('descripcion')) {
    const descripcion = optionalString(source, 'descripcion', MAX_DESCRIPCION)
    if (!descripcion.ok) return descripcion
    if (descripcion.value !== undefined) partial.descripcion = descripcion.value
  } else if (requireAll) {
    partial.descripcion = ''
  }

  if (present('categoria')) {
    const categoria = requiredString(source, 'categoria', MAX_CATEGORIA)
    if (!categoria.ok) return categoria
    partial.categoria = categoria.value
  } else if (requireAll) {
    return { ok: false, error: 'Falta "categoria".' }
  }

  if (present('codigo')) {
    const codigo = optionalString(source, 'codigo', MAX_CODIGO)
    if (!codigo.ok) return codigo
    if (codigo.value !== undefined) partial.codigo = codigo.value
  }

  if (present('ubicacion')) {
    const ubicacion = parseUbicacion(source.ubicacion)
    if (!ubicacion.ok) return ubicacion
    partial.ubicacion = ubicacion.value
  } else if (requireAll) {
    return { ok: false, error: 'Falta "ubicacion".' }
  }

  if (present('gps')) {
    const gps = parseGps(source.gps)
    if (!gps.ok) return gps
    partial.gps = gps.value
  } else if (requireAll) {
    return { ok: false, error: 'Falta "gps".' }
  }

  if (present('estado')) {
    const estado = parseEstado(source.estado)
    if (!estado.ok) return estado
    partial.estado = estado.value
  } else if (requireAll) {
    partial.estado = 'pendiente'
  }

  if (present('levantamientoId')) {
    const levantamientoId = optionalString(source, 'levantamientoId', MAX_MODULE_ID)
    if (!levantamientoId.ok) return levantamientoId
    if (levantamientoId.value !== undefined) partial.levantamientoId = levantamientoId.value
  }

  if (present('geometria')) {
    const geometria = parseGeometria(source.geometria)
    if (!geometria.ok) return geometria
    if (geometria.value !== undefined) partial.geometria = geometria.value
  }

  if (present('areaM2')) {
    const areaM2 = optionalNumber(source, 'areaM2', { min: 0 })
    if (!areaM2.ok) return areaM2
    if (areaM2.value !== undefined) partial.areaM2 = areaM2.value
  }

  if (present('perimetroM')) {
    const perimetroM = optionalNumber(source, 'perimetroM', { min: 0 })
    if (!perimetroM.ok) return perimetroM
    if (perimetroM.value !== undefined) partial.perimetroM = perimetroM.value
  }

  if (!requireAll) {
    return { ok: true, value: partial as ParcelaCoreInput }
  }

  return { ok: true, value: partial as ParcelaCoreInput }
}

/** Valida una petición de creación de parcela. */
export function parseParcelaCreate(input: unknown): ParseResult<ParcelaCreateRequest> {
  if (!isRecord(input)) return { ok: false, error: 'El cuerpo de la petición debe ser un objeto.' }

  const id = requiredString(input, 'id', 64)
  if (!id.ok) return id

  const core = parseCore(input, { requireAll: true })
  if (!core.ok) return core

  const modulos = parseModuloUpdates(input.modulos)
  if (!modulos.ok) return modulos

  return { ok: true, value: { id: id.value, ...core.value, modulos: modulos.value } }
}

/** Valida una petición de actualización parcial. */
export function parseParcelaPatch(input: unknown): ParseResult<ParcelaPatchRequest> {
  if (!isRecord(input)) return { ok: false, error: 'El cuerpo de la petición debe ser un objeto.' }

  const hasCore =
    input.nombre !== undefined ||
    input.descripcion !== undefined ||
    input.categoria !== undefined ||
    input.codigo !== undefined ||
    input.ubicacion !== undefined ||
    input.gps !== undefined ||
    input.estado !== undefined ||
    input.levantamientoId !== undefined ||
    input.geometria !== undefined ||
    input.areaM2 !== undefined ||
    input.perimetroM !== undefined

  let core: Partial<ParcelaCoreInput> | undefined
  if (hasCore) {
    const parsed = parseCore(input, { requireAll: false })
    if (!parsed.ok) return parsed
    core = parsed.value
  }

  const modulos = parseModuloUpdates(input.modulos)
  if (!modulos.ok) return modulos

  if (!core && modulos.value.length === 0) {
    return { ok: false, error: 'La actualización no contiene ningún campo.' }
  }

  return { ok: true, value: { core, modulos: modulos.value } }
}

/** Valida una tanda de sincronización. */
export function parseSyncRequest(input: unknown): ParseResult<SyncRequest> {
  if (!isRecord(input)) return { ok: false, error: 'El cuerpo de la petición debe ser un objeto.' }

  const parcels = input.parcels
  if (!Array.isArray(parcels)) return { ok: false, error: '"parcels" debe ser una lista.' }
  if (parcels.length > MAX_SYNC_BATCH) {
    return {
      ok: false,
      error: `La tanda no puede superar ${MAX_SYNC_BATCH} parcelas (van ${parcels.length}).`,
    }
  }

  const parsed: ParcelaCreateRequest[] = []
  for (const item of parcels) {
    const result = parseParcelaCreate(item)
    if (!result.ok) return result
    parsed.push(result.value)
  }

  return { ok: true, value: { parcels: parsed } }
}

/** Lee los parámetros de listado de la URL. */
export function parseListQuery(url: URL): {
  levantamientoId?: string
  estado?: ParcelaEstado
  limite: number
  skip: number
} {
  const limiteRaw = Number(url.searchParams.get('limite') ?? '50')
  const skipRaw = Number(url.searchParams.get('skip') ?? '0')

  const limite = Number.isFinite(limiteRaw)
    ? Math.min(Math.max(Math.trunc(limiteRaw), 1), MAX_LIST_LIMIT)
    : 50
  const skip = Number.isFinite(skipRaw) ? Math.max(Math.trunc(skipRaw), 0) : 0

  const estadoRaw = url.searchParams.get('estado')
  const estado =
    estadoRaw === 'pendiente' || estadoRaw === 'completa' || estadoRaw === 'en_revision'
      ? estadoRaw
      : undefined

  const levantamientoId = url.searchParams.get('levantamientoId')?.trim() || undefined

  return { levantamientoId, estado, limite, skip }
}
