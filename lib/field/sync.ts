import { MAX_SYNC_BATCH, type ParcelaCreateRequest, type SyncResponse } from '@/lib/api/contracts'
import { getCampoDB, type CampoDB } from './db'
import { applySyncPlan, getEnviableEntries } from './outbox'
import { planSync } from './sync-plan'
import type { SyncItemResult } from './types'

/**
 * Motor de sincronización del cliente de campo.
 *
 * Toma lo que hay en la cola, lo manda en una tanda, y aplica lo que el
 * servidor respondió. Es deliberadamente independiente del almacenamiento y
 * del transporte: se le pasa la base y el `fetch`, así que el motor entero
 * se puede probar sin IndexedDB real ni red.
 */

export interface SyncSummary {
  /** Cuántas parcelas se mandaron en la tanda. */
  enviadas: number
  confirmadas: number
  reintentadas: number
  conflictos: number
  /** La tanda no se hizo porque no había red. */
  omitida: boolean
  error?: string
}

export interface SyncOptions {
  db?: CampoDB
  endpoint?: string
  now?: () => number
  random?: () => number
  fetchImpl?: typeof fetch
  isOnline?: () => boolean
}

const DEFAULT_ENDPOINT = '/api/sync'

/** ¿El navegador dice que hay red? */
export function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

/**
 * Corre una tanda de sincronización.
 *
 * Nunca lanza: un fallo de red es un reintento programado, no un error que
 * rompa la app en campo. El resumen dice qué pasó para que la UI lo muestre.
 */
export async function runSync(options: SyncOptions = {}): Promise<SyncSummary> {
  const db = options.db ?? getCampoDB()
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const online = options.isOnline ?? isOnline

  if (!online()) {
    return { enviadas: 0, confirmadas: 0, reintentadas: 0, conflictos: 0, omitida: true }
  }

  const pendientes = await getEnviableEntries(now(), { db })
  if (pendientes.length === 0) {
    return { enviadas: 0, confirmadas: 0, reintentadas: 0, conflictos: 0, omitida: false }
  }

  const tanda = pendientes.slice(0, MAX_SYNC_BATCH)
  const payloads: ParcelaCreateRequest[] = tanda.map((entrada) => entrada.payload)

  let resultados = new Map<string, SyncItemResult>()
  let error: string | undefined

  try {
    const respuesta = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // La sesión vive en una cookie de primera parte: sin esto, el service
      // worker no la mandaría y la API respondería 401.
      credentials: 'same-origin',
      body: JSON.stringify({ parcels: payloads }),
    })

    if (!respuesta.ok) {
      error = `El servidor respondió ${respuesta.status}.`
    } else {
      const cuerpo = (await respuesta.json()) as SyncResponse
      resultados = new Map(cuerpo.resultados.map((item) => [item.id, item]))
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : 'No se pudo contactar al servidor.'
  }

  const plan = planSync(tanda, resultados, now(), random)
  await applySyncPlan(plan.entradas, { db })

  return {
    enviadas: tanda.length,
    confirmadas: plan.confirmadas.length,
    reintentadas: plan.aReintentar.length,
    conflictos: plan.enConflicto.length,
    omitida: false,
    error,
  }
}
