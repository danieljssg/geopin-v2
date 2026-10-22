import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import type { ModuleConflict } from '@/lib/domain/sync'
import { getCampoDB, type CampoDB } from './db'
import type { OutboxEntry, SyncPlanEntry } from './types'

/**
 * Cola de salida: lo que se capturó en campo y todavía no llegó al servidor.
 *
 * La clave primaria es el id de la parcela, no un id de entrada. Eso da la
 * idempotencia de la cola sin trabajo extra: encolar dos veces la misma
 * parcela reemplaza el contenido en vez de mandar dos versiones.
 */

/** Encola una parcela para sincronizar. */
export async function enqueueParcela(
  payload: ParcelaCreateRequest,
  options: { db?: CampoDB; now?: string } = {},
): Promise<OutboxEntry> {
  const db = options.db ?? getCampoDB()
  const now = options.now ?? new Date().toISOString()

  const existente = await db.outbox.get(payload.id)

  const entrada: OutboxEntry = {
    id: payload.id,
    payload,
    estado: 'pendiente',
    // Una edición nueva merece un intento nuevo: el error anterior era de
    // otra versión del dato.
    intentos: 0,
    creadoEn: existente?.creadoEn ?? now,
    actualizadoEn: now,
    proximoIntentoEn: now,
  }

  await db.outbox.put(entrada)
  return entrada
}

/**
 * Entradas que se pueden mandar ahora.
 *
 * Las entradas en conflicto quedan fuera: reintentarlas daría el mismo
 * conflicto. Necesitan que alguien las resuelva.
 */
export async function getEnviableEntries(
  now: number,
  options: { db?: CampoDB } = {},
): Promise<OutboxEntry[]> {
  const db = options.db ?? getCampoDB()
  const momento = new Date(now).toISOString()

  const candidatas = await db.outbox.where('estado').anyOf('pendiente', 'fallido').toArray()

  return candidatas
    .filter((entrada) => entrada.proximoIntentoEn <= momento)
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
}

/** Todas las entradas, incluidas las que están en conflicto. */
export async function getAllEntries(options: { db?: CampoDB } = {}): Promise<OutboxEntry[]> {
  const db = options.db ?? getCampoDB()
  return db.outbox.toArray()
}

/** Cuántas entradas quedan sin sincronizar. */
export async function countPending(options: { db?: CampoDB } = {}): Promise<number> {
  const db = options.db ?? getCampoDB()
  return db.outbox.count()
}

/** Entradas que necesitan atención humana. */
export async function getConflictedEntries(options: { db?: CampoDB } = {}): Promise<OutboxEntry[]> {
  const db = options.db ?? getCampoDB()
  return db.outbox.where('estado').equals('conflicto').toArray()
}

/**
 * Aplica el plan de una tanda: saca las confirmadas, reprograma las que
 * fallaron y deja las que quedaron en conflicto con su detalle.
 */
export async function applySyncPlan(
  plan: SyncPlanEntry[],
  options: { db?: CampoDB; now?: string } = {},
): Promise<void> {
  const db = options.db ?? getCampoDB()
  const now = options.now ?? new Date().toISOString()

  await db.transaction('rw', db.outbox, async () => {
    for (const entrada of plan) {
      if (entrada.accion === 'confirmado') {
        await db.outbox.delete(entrada.id)
        continue
      }

      const existente = await db.outbox.get(entrada.id)
      if (!existente) continue

      const conflictos: ModuleConflict[] | undefined =
        entrada.accion === 'conflicto' ? (entrada.conflictos ?? []) : undefined

      await db.outbox.put({
        ...existente,
        estado: entrada.accion === 'conflicto' ? 'conflicto' : 'fallido',
        intentos: entrada.intentos,
        proximoIntentoEn: entrada.proximoIntentoEn,
        ultimoError: entrada.ultimoError,
        conflictos,
        actualizadoEn: now,
      })
    }
  })
}

/**
 * Saca de la cola una entrada que el usuario resolvió a mano.
 *
 * La resolución la escribe T9; acá solo se libera la cola.
 */
export async function discardEntry(id: string, options: { db?: CampoDB } = {}): Promise<void> {
  const db = options.db ?? getCampoDB()
  await db.outbox.delete(id)
}
