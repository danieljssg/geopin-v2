import type { ParcelaCreateRequest, SyncItemResult } from '@/lib/api/contracts'
import type { ModuleConflict } from '@/lib/domain/sync'
import type { ModuleSchema, ParcelaEstado } from '@/lib/domain/types'

/**
 * Tipos de la base de datos local del cliente de campo.
 *
 * El cliente guarda tres cosas: la cola de salida (lo que falta sincronizar),
 * una caché de las parcelas que ya conoce el servidor (con la versión que
 * tiene, que es lo que permite detectar conflictos) y los esquemas
 * publicados (para que el formulario funcione sin red).
 */

/**
 * Estado de una entrada de la cola.
 *
 * No hay un estado "enviando": si la app muere a mitad de un envío, la
 * entrada queda "pendiente" y se reintenta. Es entrega al menos una vez, y
 * la idempotencia del lado del servidor la convierte en exactamente una.
 */
export type OutboxEstado = 'pendiente' | 'fallido' | 'conflicto'

export interface OutboxEntry {
  /** Id de la parcela. Es la clave primaria: una parcela no ocupa dos filas. */
  id: string
  /** Lo que se manda al servidor. */
  payload: ParcelaCreateRequest
  estado: OutboxEstado
  intentos: number
  ultimoError?: string
  /** Detalle del conflicto, cuando lo hubo. Requiere acción humana. */
  conflictos?: ModuleConflict[]
  creadoEn: string
  actualizadoEn: string
  /** ISO de cuándo se puede reintentar. */
  proximoIntentoEn: string
}

/** Una parcela que el servidor ya conoce, con las versiones que tiene. */
export interface ParcelaCache {
  id: string
  /** Última versión conocida de cada módulo, para detectar conflictos. */
  moduleVersions: Record<string, number>
  /** Versión global del documento en el servidor. */
  serverVersion: number
  estado: ParcelaEstado
  /** Lo que se envió al servidor. */
  payload: ParcelaCreateRequest
  syncedAt: string
}

/** Un esquema publicado, guardado para poder renderizar el formulario offline. */
export interface SchemaCache {
  moduleId: string
  schema: ModuleSchema
  cachedAt: string
}

/** Qué hay que hacer con cada entrada después de una tanda de sync. */
export type SyncAccion = 'confirmado' | 'reintentar' | 'conflicto'

export interface SyncPlanEntry {
  id: string
  accion: SyncAccion
  intentos: number
  proximoIntentoEn: string
  ultimoError?: string
  conflictos?: ModuleConflict[]
}

export interface SyncPlan {
  entradas: SyncPlanEntry[]
  confirmadas: string[]
  aReintentar: string[]
  enConflicto: string[]
}

export type { SyncItemResult }
