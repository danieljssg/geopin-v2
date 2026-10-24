import { schemasCollection } from '../collections'
import { validateModuleData } from '@/lib/domain/schema'
import type { FieldError, ModuleSchema } from '@/lib/domain/types'

/**
 * Acceso a los esquemas publicados de los módulos.
 *
 * El esquema es la fuente de la verdad de qué campos existen y de qué tipo.
 * La app de campo lo guarda junto a la visita para poder renderizar la
 * captura tal como se vio aunque el administrador haya cambiado el esquema
 * después.
 */

export async function getModuleSchemas(): Promise<Map<string, ModuleSchema>> {
  const docs = await schemasCollection().find({}).toArray()
  return new Map(docs.map((doc) => [doc.moduleId, doc]))
}

export async function getModuleSchema(moduleId: string): Promise<ModuleSchema | null> {
  return schemasCollection().findOne({ _id: moduleId })
}

/**
 * Publica un esquema. Reemplaza el documento del módulo.
 *
 * No hay historial de versiones todavía: la versión viaja en el documento y
 * cada visita guarda la versión con la que se capturó, así que un dato viejo
 * se puede interpretar. Guardar el historial completo es trabajo de T10, que
 * es donde se concilian registros de distintas versiones.
 */
export async function saveModuleSchema(schema: ModuleSchema): Promise<ModuleSchema> {
  // El `_id` sale del filtro: el documento de reemplazo no lo lleva, y el
  // upsert lo toma de la igualdad del filtro.
  await schemasCollection().replaceOne({ _id: schema.moduleId }, { ...schema }, { upsert: true })
  return schema
}

/**
 * Valida los datos de un módulo contra su esquema publicado.
 *
 * Si el módulo no tiene esquema publicado se acepta todo: el administrador
 * puede haber agregado el módulo a la app sin publicar todavía su esquema,
 * y bloquear la captura en campo por eso sería peor que el dato sin validar.
 */
export function validateAgainstSchema(
  schema: ModuleSchema | null | undefined,
  datos: Record<string, unknown>,
): FieldError[] {
  if (!schema) return []
  return validateModuleData(schema.campos, datos)
}
