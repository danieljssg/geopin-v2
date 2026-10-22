import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import type { ModuleSchema, ParcelaEstado } from '@/lib/domain/types'
import { getCampoDB, type CampoDB } from './db'
import type { ParcelaCache, SchemaCache } from './types'

/**
 * Caché local de lo que el servidor ya conoce.
 *
 * Sirve para dos cosas: mostrar la última versión conocida cuando no hay
 * red, y saber qué `baseVersion` mandar en la próxima edición de cada
 * módulo. Sin esa versión, el servidor no puede distinguir una edición
 * nueva de un reintento.
 */

export async function cacheParcela(
  input: {
    payload: ParcelaCreateRequest
    moduleVersions: Record<string, number>
    serverVersion: number
    estado: ParcelaEstado
  },
  options: { db?: CampoDB; now?: string } = {},
): Promise<ParcelaCache> {
  const db = options.db ?? getCampoDB()
  const now = options.now ?? new Date().toISOString()

  const entrada: ParcelaCache = {
    id: input.payload.id,
    moduleVersions: input.moduleVersions,
    serverVersion: input.serverVersion,
    estado: input.estado,
    payload: input.payload,
    syncedAt: now,
  }

  await db.parcelas.put(entrada)
  return entrada
}

export async function getCachedParcelas(options: { db?: CampoDB } = {}): Promise<ParcelaCache[]> {
  const db = options.db ?? getCampoDB()
  return db.parcelas.toArray()
}

export async function getCachedParcela(
  id: string,
  options: { db?: CampoDB } = {},
): Promise<ParcelaCache | undefined> {
  const db = options.db ?? getCampoDB()
  return db.parcelas.get(id)
}

/** Guarda los esquemas publicados para poder renderizar el formulario offline. */
export async function cacheEsquemas(
  esquemas: ModuleSchema[],
  options: { db?: CampoDB; now?: string } = {},
): Promise<void> {
  const db = options.db ?? getCampoDB()
  const now = options.now ?? new Date().toISOString()

  await db.transaction('rw', db.esquemas, async () => {
    for (const esquema of esquemas) {
      const entrada: SchemaCache = {
        moduleId: esquema.moduleId,
        schema: esquema,
        cachedAt: now,
      }
      await db.esquemas.put(entrada)
    }
  })
}

export async function getCachedEsquemas(options: { db?: CampoDB } = {}): Promise<SchemaCache[]> {
  const db = options.db ?? getCampoDB()
  return db.esquemas.toArray()
}
