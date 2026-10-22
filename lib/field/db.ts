import Dexie, { type Table } from 'dexie'
import type { OutboxEntry, ParcelaCache, SchemaCache } from './types'

/**
 * Base de datos local del cliente de campo.
 *
 * Es una base separada de la del prototipo (`geopin`, tabla `pins`) para que
 * las dos convivan sin migraciones mientras el cliente v2 reemplaza al v1.
 * Cuando T6 termine el reemplazo, la base vieja se borra.
 *
 * Tres tablas:
 *
 * - `outbox`: la cola de salida. Lo que falta sincronizar.
 * - `parcelas`: lo que el servidor ya conoce, con las versiones que tiene.
 * - `esquemas`: los esquemas publicados, para que el formulario funcione
 *   sin red.
 */
export class CampoDB extends Dexie {
  outbox!: Table<OutboxEntry, string>
  parcelas!: Table<ParcelaCache, string>
  esquemas!: Table<SchemaCache, string>

  constructor(name = 'geopin-field') {
    super(name)
    this.version(1).stores({
      // `id` es la clave primaria y es el id de la parcela: una parcela no
      // ocupa dos filas de la cola, así que encolar dos veces la misma
      // reemplaza en vez de duplicar.
      outbox: 'id, estado, proximoIntentoEn, creadoEn',
      parcelas: 'id, estado, syncedAt',
      esquemas: 'moduleId',
    })
  }
}

let singleton: CampoDB | null = null

/** Instancia compartida del cliente. */
export function getCampoDB(): CampoDB {
  if (!singleton) singleton = new CampoDB()
  return singleton
}

/** Borra la base y la vuelve a crear. Solo para tests. */
export async function resetCampoDB(db: CampoDB): Promise<void> {
  await db.delete()
  await db.open()
}
