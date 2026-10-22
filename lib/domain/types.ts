/**
 * Modelo de dominio v2.
 *
 * Sustituye al `Pin` plano (`lib/types.ts`) que usa el prototipo actual.
 * La diferencia clave es `modulos`: los valores de cada módulo viven en un
 * diccionario por módulo, de modo que un campo nuevo creado en el
 * administrador de esquemas (Fase 3) se guarda sin migración de esquema.
 */

/** Identificadores de los tres módulos temáticos del plan. */
export type ModuloId = 'edificacion' | 'infraestructura' | 'equipamiento'

/** Tipos de dato soportados por el administrador de esquemas. */
export type FieldType = 'texto' | 'entero' | 'decimal' | 'booleano' | 'lista' | 'fecha'

/** Estados de una parcela dentro de un levantamiento. */
export type ParcelaEstado = 'pendiente' | 'completa' | 'en_revision'

/** Origen de la posición: sensor GPS o ajuste manual del surveyor. */
export type GpsFuente = 'sensor' | 'manual'

/**
 * GeoJSON. Cosmos DB for MongoDB indexa estos campos con `2dsphere`.
 * El orden de las coordenadas es [longitud, latitud] (RFC 7946).
 */
export interface GeoPoint {
  type: 'Point'
  coordinates: [number, number]
}

export interface GeoPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

/** Definición de un campo editable de un módulo. */
export interface FieldDef {
  /** Identificador estable del campo. Nunca se renombra: se elimina y se crea. */
  key: string
  label: string
  tipo: FieldType
  /** Valores permitidos. Solo aplica a `lista`. */
  opciones?: string[]
  requerido?: boolean
  orden: number
}

/** Esquema publicado de un módulo. */
export interface ModuleSchema {
  moduleId: string
  modulo: ModuloId
  version: number
  campos: FieldDef[]
  actualizadoEn: string
  actualizadoPor: string
}

/** Datos capturados de un módulo dentro de una parcela. */
export interface ParcelaModuloData {
  /** Versión del esquema con el que se capturó. Permite renderizar la visita tal como se vio. */
  schemaVersion: number
  datos: Record<string, unknown>
  actualizadoEn: string
  actualizadoPor: string
}

/** Registro de posición con su provenance, para auditar el error del pin. */
export interface ParcelaGps {
  fuente: GpsFuente
  /** `coords.accuracy` en metros en el momento de fijar. */
  precision?: number
  fijadoEn?: string
}

/** Entidad principal: una parcela levantada. */
export interface Parcela {
  id: string
  /** Clave catastral o código de parcela. Único cuando existe. */
  codigo?: string
  nombre: string
  descripcion: string
  categoria: string
  ubicacion: GeoPoint
  geometria?: GeoPolygon
  areaM2?: number
  perimetroM?: number
  gps: ParcelaGps
  estado: ParcelaEstado
  /** Campaña de levantamiento a la que pertenece. Permite el "163 de 283". */
  levantamientoId?: string
  /** Datos por módulo, cada uno con su propia versión y autoría. */
  modulos: Record<string, ParcelaModuloData>
  /** Versión global del documento. Control de concurrencia optimista. */
  version: number
  creadoEn: string
  creadoPor: string
  actualizadoEn: string
  actualizadoPor: string
}

/** Campaña de levantamiento: agrupa parcelas y declara el total esperado. */
export interface Levantamiento {
  id: string
  nombre: string
  ciudad: string
  totalEsperado: number
  creadoEn: string
  creadoPor: string
}

/** Error de validación de un campo del esquema. */
export interface FieldError {
  key: string
  message: string
}
