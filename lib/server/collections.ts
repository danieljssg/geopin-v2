import type { Collection } from 'mongodb'
import { getDb } from './cosmos'
import type { Levantamiento, ModuleSchema, Parcela } from '@/lib/domain/types'

/**
 * Colecciones de la base de datos y sus índices.
 *
 * En Cosmos DB for MongoDB el `_id` es la clave de partición implícita: se
 * elige siempre el id de la parcela para que un documento se lea y se escriba
 * en una sola operación (RU/s) y para que la idempotencia del sync sea
 * natural.
 */

export const COLLECTION_PARECLAS = 'parcelas'
export const COLLECTION_SCHEMAS = 'schemas'
export const COLLECTION_LEVANTAMIENTOS = 'levantamientos'

/** Documento de parcela tal y como se guarda: `_id` replica el `id` de negocio. */
export type ParcelaDoc = Parcela & { _id: string }

export type SchemaDoc = ModuleSchema & { _id: string }

export type LevantamientoDoc = Levantamiento & { _id: string }

export function parcelasCollection(): Collection<ParcelaDoc> {
  return getDb().collection<ParcelaDoc>(COLLECTION_PARECLAS)
}

export function schemasCollection(): Collection<SchemaDoc> {
  return getDb().collection<SchemaDoc>(COLLECTION_SCHEMAS)
}

export function levantamientosCollection(): Collection<LevantamientoDoc> {
  return getDb().collection<LevantamientoDoc>(COLLECTION_LEVANTAMIENTOS)
}

/**
 * Crea los índices si no existen.
 *
 * `createIndexes` es idempotente en MongoDB: volver a llamarlo con la misma
 * definición no falla, solo no hace nada. Por eso se puede llamar en cada
 * arranque sin miedo.
 *
 * Nota sobre el free tier de Cosmos (1000 RU/s, 25 GB): cada índice consume
 * almacenamiento y operaciones de escritura adicionales. Por eso el conjunto
 * es deliberadamente corto — los campos dinámicos que el administrador de
 * esquemas agregue se indexan solo cuando el cliente lo justifique, porque
 * indexar un campo dinámico obliga a crear un índice nuevo por cada par
 * módulo/campo.
 */
export async function ensureIndexes(): Promise<void> {
  const db = getDb()

  await db.collection(COLLECTION_PARECLAS).createIndexes([
    {
      key: { ubicacion: '2dsphere' },
      name: 'ubicacion_2dsphere',
    },
    {
      key: { codigo: 1 },
      name: 'codigo_unique',
      unique: true,
      sparse: true,
    },
    {
      key: { estado: 1 },
      name: 'estado',
    },
    {
      key: { levantamientoId: 1 },
      name: 'levantamiento',
    },
    {
      key: { creadoEn: -1 },
      name: 'creadoEn',
    },
  ])

  await db.collection(COLLECTION_SCHEMAS).createIndexes([
    {
      key: { modulo: 1 },
      name: 'modulo',
    },
  ])

  await db.collection(COLLECTION_LEVANTAMIENTOS).createIndexes([
    {
      key: { ciudad: 1 },
      name: 'ciudad',
    },
  ])
}
