import { jsonEquals } from './json'
import type { ParcelaModuloData } from './types'

/**
 * Aplicación de escrituras de módulos sobre una parcela.
 *
 * Toda la lógica de concurrencia vive acá y es pura: el repositorio solo
 * lee, llama a esta función y persiste el resultado. Eso la hace testeable
 * sin base de datos y reutilizable tanto por la API como por el sync.
 *
 * Reglas:
 *
 * 1. **Módulos distintos no colisionan.** Cada módulo tiene su propia
 *    versión, así que dos encuestadores sobre módulos diferentes de la misma
 *    parcela se pisan cero. Es el requisito de concurrencia de la Fase 3.
 *
 * 2. **El cliente declara la versión que leyó** (`baseVersion`). Si coincide
 *    con la versión actual, la escritura se aplica y la versión sube.
 *
 * 3. **Un reintento no es un conflicto.** Si la versión no coincide pero los
 *    datos son idénticos a los que ya están guardados, la escritura ya se
 *    aplicó: se devuelve `ignorado` y no se toca nada. Sin esta regla, un
 *    reintento por una respuesta perdida se reportaría como conflicto y el
 *    levantador vería un error falso.
 *
 * 4. **Un conflicto real no pisa nada.** Se devuelve el estado actual del
 *    módulo para que la app pueda mostrar la diferencia y resolverla.
 */

export interface ModuloUpdate {
  moduleId: string
  /** Versión del módulo que el cliente leyó antes de editar. */
  baseVersion: number
  /** Versión del esquema con el que se editó. */
  schemaVersion: number
  datos: Record<string, unknown>
}

export type ModuleOutcome = 'aplicado' | 'ignorado' | 'conflicto'

export interface ModuleConflict {
  moduleId: string
  baseVersion: number
  currentVersion: number
  currentDatos: Record<string, unknown>
  actualizadoPor: string
  actualizadoEn: string
}

export interface ApplyResult {
  modulos: Record<string, ParcelaModuloData>
  resultados: Record<string, ModuleOutcome>
  conflictos: ModuleConflict[]
}

export interface Actor {
  id: string
  nombre: string
}

/**
 * Aplica las escrituras de módulos sobre el estado actual.
 *
 * @param current Módulos actuales de la parcela. `undefined` si la parcela no
 *                existe todavía.
 * @param updates Escrituras recibidas del cliente.
 * @param actor Quién hace el cambio. Se guarda en `actualizadoPor`.
 * @param now Marca de tiempo ISO. Se pasa por parámetro para que la función
 *            sea determinista y testeable.
 */
export function applyModuleUpdates(
  current: Record<string, ParcelaModuloData> | undefined,
  updates: readonly ModuloUpdate[],
  actor: Actor,
  now: string,
): ApplyResult {
  const modulos: Record<string, ParcelaModuloData> = { ...(current ?? {}) }
  const resultados: Record<string, ModuleOutcome> = {}
  const conflictos: ModuleConflict[] = []

  for (const update of updates) {
    const actual = modulos[update.moduleId]

    if (!actual) {
      modulos[update.moduleId] = {
        version: 1,
        schemaVersion: update.schemaVersion,
        datos: update.datos,
        actualizadoEn: now,
        actualizadoPor: actor.id,
      }
      resultados[update.moduleId] = 'aplicado'
      continue
    }

    if (update.baseVersion === actual.version) {
      modulos[update.moduleId] = {
        ...actual,
        version: actual.version + 1,
        schemaVersion: update.schemaVersion,
        datos: update.datos,
        actualizadoEn: now,
        actualizadoPor: actor.id,
      }
      resultados[update.moduleId] = 'aplicado'
      continue
    }

    if (jsonEquals(actual.datos, update.datos)) {
      // Reintento de una escritura que ya se aplicó.
      resultados[update.moduleId] = 'ignorado'
      continue
    }

    resultados[update.moduleId] = 'conflicto'
    conflictos.push({
      moduleId: update.moduleId,
      baseVersion: update.baseVersion,
      currentVersion: actual.version,
      currentDatos: actual.datos,
      actualizadoPor: actual.actualizadoPor,
      actualizadoEn: actual.actualizadoEn,
    })
  }

  return { modulos, resultados, conflictos }
}

/** ¿El resultado tiene algún conflicto? */
export function hasConflicts(result: ApplyResult): boolean {
  return result.conflictos.length > 0
}

/** Módulos que efectivamente se escribieron. */
export function appliedModules(result: ApplyResult): string[] {
  return Object.entries(result.resultados)
    .filter(([, outcome]) => outcome === 'aplicado')
    .map(([moduleId]) => moduleId)
}
