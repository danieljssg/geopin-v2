import type { SyncItemResult } from '@/lib/api/contracts'
import type { ModuleConflict } from '@/lib/domain/sync'
import type { OutboxEntry, SyncAccion, SyncPlan, SyncPlanEntry } from './types'

/**
 * Decisión de qué hacer con cada entrada de la cola después de una tanda.
 *
 * Es puro a propósito: la regla de "qué hago con esta entrada" es la parte
 * que más bugs produce, y separarla del transporte y del almacenamiento la
 * deja testear sin IndexedDB ni red.
 */

/** Espera base antes del primer reintento. */
export const BACKOFF_BASE_MS = 5_000

/** Espera máxima entre reintentos. */
export const BACKOFF_MAX_MS = 5 * 60_000

/**
 * Espera para el reintento número `intentos`, con jitter.
 *
 * El jitter importa: si veinte dispositivos pierden la señal en el mismo
 * momento y reconectan juntos, sin variación todos reintentan en el mismo
 * instante y le pegan al servidor de golpe. Con la variación se reparten.
 *
 * El `random` es inyectable para que el test sea determinista.
 */
export function computeBackoffMs(intentos: number, random: () => number = Math.random): number {
  const exponencial = Math.min(
    BACKOFF_BASE_MS * 2 ** Math.max(0, intentos - 1),
    BACKOFF_MAX_MS,
  )
  const jitter = 0.8 + random() * 0.4
  return Math.round(exponencial * jitter)
}

/**
 * Calcula el plan de una tanda de sync.
 *
 * @param entradas  Entradas que se mandaron.
 * @param resultados Lo que el servidor respondió, indexado por id de parcela.
 * @param now       Momento actual en milisegundos.
 * @param random    Fuente de aleatoriedad para el jitter.
 */
export function planSync(
  entradas: readonly OutboxEntry[],
  resultados: ReadonlyMap<string, SyncItemResult>,
  now: number,
  random: () => number = Math.random,
): SyncPlan {
  const plan: SyncPlanEntry[] = []
  const confirmadas: string[] = []
  const aReintentar: string[] = []
  const enConflicto: string[] = []

  for (const entrada of entradas) {
    const resultado = resultados.get(entrada.id)

    if (!resultado) {
      // El servidor no respondió sobre esta entrada. Se reintenta.
      const reintento = reintentar(entrada, now, random)
      plan.push(reintento)
      aReintentar.push(entrada.id)
      continue
    }

    switch (resultado.estado) {
      case 'creado':
      case 'actualizado':
      case 'ignorado': {
        plan.push({
          id: entrada.id,
          accion: 'confirmado',
          intentos: entrada.intentos,
          proximoIntentoEn: entrada.proximoIntentoEn,
        })
        confirmadas.push(entrada.id)
        break
      }

      case 'conflicto': {
        // Un conflicto real no se reintenta solo: reintentarlo daría el
        // mismo conflicto. Queda esperando que alguien lo resuelva.
        const conflictos = (resultado.conflictos ?? []) as ModuleConflict[]
        plan.push({
          id: entrada.id,
          accion: 'conflicto',
          intentos: entrada.intentos,
          proximoIntentoEn: entrada.proximoIntentoEn,
          conflictos,
          ultimoError: 'La parcela fue modificada por otra persona.',
        })
        enConflicto.push(entrada.id)
        break
      }

      case 'error':
      default: {
        const reintento = reintentar(entrada, now, random, resultado.error)
        plan.push(reintento)
        aReintentar.push(entrada.id)
        break
      }
    }
  }

  return { entradas: plan, confirmadas, aReintentar, enConflicto }
}

function reintentar(
  entrada: OutboxEntry,
  now: number,
  random: () => number,
  error?: string,
): SyncPlanEntry {
  const intentos = entrada.intentos + 1
  const espera = computeBackoffMs(intentos, random)
  return {
    id: entrada.id,
    accion: 'reintentar' as SyncAccion,
    intentos,
    proximoIntentoEn: new Date(now + espera).toISOString(),
    ultimoError: error ?? entrada.ultimoError,
  }
}
