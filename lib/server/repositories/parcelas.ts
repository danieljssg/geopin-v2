import { parcelasCollection } from '../collections'
import type { ParcelaDoc } from '../collections'

export type { ParcelaDoc }
import type { Parcela, ParcelaEstado } from '@/lib/domain/types'
import { stripUndefinedDeep } from '@/lib/domain/json'

/**
 * Acceso a la colección de parcelas.
 *
 * La capa de repositorio no sabe nada de concurrencia: lee, el route handler
 * aplica la lógica de `lib/domain/sync.ts` y el repositorio persiste. Así la
 * regla de conflicto queda en un módulo puro y testeable.
 */

export interface ParcelaFilter {
  levantamientoId?: string
  estado?: ParcelaEstado
  /** Dueño de la parcela. El route handler lo fuerza al usuario sin rol admin. */
  creadoPor?: string
  limite: number
  skip: number
}

function buildFilter(
  filter: Pick<ParcelaFilter, 'levantamientoId' | 'estado' | 'creadoPor'>,
) {
  const query: Record<string, unknown> = {}
  if (filter.levantamientoId) query.levantamientoId = filter.levantamientoId
  if (filter.estado) query.estado = filter.estado
  if (filter.creadoPor) query.creadoPor = filter.creadoPor
  return query
}

export async function listParcelas(filter: ParcelaFilter): Promise<ParcelaDoc[]> {
  return parcelasCollection()
    .find(buildFilter(filter))
    .sort({ creadoEn: -1 })
    .skip(filter.skip)
    .limit(filter.limite)
    .toArray()
}

export async function countParcelas(
  filter: Pick<ParcelaFilter, 'levantamientoId' | 'estado' | 'creadoPor'>,
): Promise<number> {
  return parcelasCollection().countDocuments(buildFilter(filter))
}

export async function findParcela(id: string): Promise<ParcelaDoc | null> {
  return parcelasCollection().findOne({ _id: id })
}

/**
 * Guarda la parcela. Si el `_id` ya existe, lo reemplaza.
 *
 * El `_id` sale del filtro del upsert, así que el documento que se persiste
 * no lo lleva: en MongoDB el `_id` de un documento insertado por upsert se
 * toma de las igualdades del filtro.
 *
 * Los campos con `undefined` se omiten: un `codigo` ausente no puede viajar
 * como `null` o chocaría con el índice único de códigos.
 */
export async function saveParcela(doc: ParcelaDoc): Promise<ParcelaDoc> {
  const { _id, ...body } = doc
  const limpio = stripUndefinedDeep(body)
  await parcelasCollection().replaceOne({ _id }, limpio, { upsert: true })
  return { ...limpio, _id }
}

export async function deleteParcela(id: string): Promise<boolean> {
  const result = await parcelasCollection().deleteOne({ _id: id })
  return result.deletedCount > 0
}

/**
 * Construye el documento de parcela a partir del estado actual y la
 * actualización aplicada.
 */
export function buildParcelaDoc(input: {
  id: string
  base: Parcela
  modulos: Parcela['modulos']
  actualizadoEn: string
  actualizadoPor: string
}): ParcelaDoc {
  return {
    ...input.base,
    modulos: input.modulos,
    version: input.base.version + 1,
    actualizadoEn: input.actualizadoEn,
    actualizadoPor: input.actualizadoPor,
    _id: input.id,
  }
}
