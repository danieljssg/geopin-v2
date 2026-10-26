import { levantamientosCollection, parcelasCollection, type LevantamientoDoc } from '../collections'
import type { Levantamiento } from '@/lib/domain/types'

/**
 * Acceso a los levantamientos.
 *
 * Un levantamiento es la campaña: agrupa parcelas y declara cuántas se
 * esperan. Es lo que permite el "163 de 283" del plan — sin un total
 * esperado no hay contra qué medir el avance.
 */

export async function listLevantamientos(): Promise<LevantamientoDoc[]> {
  return levantamientosCollection().find({}).sort({ creadoEn: -1 }).toArray()
}

export async function findLevantamiento(id: string): Promise<LevantamientoDoc | null> {
  return levantamientosCollection().findOne({ _id: id })
}

export async function createLevantamiento(input: Levantamiento): Promise<LevantamientoDoc> {
  // El `_id` sale del filtro del upsert; el documento conserva además `id`,
  // igual que las parcelas, para que el dominio no dependa del driver.
  await levantamientosCollection().replaceOne({ _id: input.id }, { ...input }, { upsert: true })
  return { ...input, _id: input.id }
}

/** Campos que el panel puede editar de una campaña ya creada. */
export interface CambiosLevantamiento {
  nombre?: string
  ciudad?: string
  totalEsperado?: number
}

/**
 * Actualiza los campos editables y devuelve el documento resultante.
 *
 * No es un upsert: editar una campaña que no existe es un 404, no un alta
 * silenciosa con datos a medias. `findOneAndUpdate` devuelve el documento ya
 * actualizado en una sola operación, así la respuesta del PATCH no puede
 * quedar desfasada por una escritura intermedia. `creadoPor` y `creadoEn`
 * quedan fuera a propósito: la autoría no se edita.
 */
export async function updateLevantamiento(
  id: string,
  cambios: CambiosLevantamiento,
): Promise<LevantamientoDoc | null> {
  const set: Partial<Pick<Levantamiento, 'nombre' | 'ciudad' | 'totalEsperado'>> = {}
  if (cambios.nombre !== undefined) set.nombre = cambios.nombre
  if (cambios.ciudad !== undefined) set.ciudad = cambios.ciudad
  if (cambios.totalEsperado !== undefined) set.totalEsperado = cambios.totalEsperado

  return levantamientosCollection().findOneAndUpdate(
    { _id: id },
    { $set: set },
    { returnDocument: 'after' },
  )
}

/**
 * Todas las parcelas de un levantamiento (o todas, sin filtro).
 *
 * El dashboard necesita el conjunto completo, no una página: los porcentajes
 * de cobertura sobre una página de 200 de 283 parcelas mentirían. El tope es
 * de seguridad, no de paginación.
 */
export const MAX_PARCELAS_DASHBOARD = 5_000

export async function findParcelasParaDashboard(levantamientoId?: string) {
  const filtro = levantamientoId ? { levantamientoId } : {}
  return parcelasCollection().find(filtro).limit(MAX_PARCELAS_DASHBOARD).toArray()
}

export async function deleteLevantamiento(id: string): Promise<boolean> {
  const resultado = await levantamientosCollection().deleteOne({ _id: id })
  return resultado.deletedCount > 0
}
