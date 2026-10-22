import { applyModuleUpdates, type ModuleConflict, type ModuleOutcome } from '@/lib/domain/sync'
import { toGeoPoint } from '@/lib/domain/parcela'
import type { Parcela } from '@/lib/domain/types'
import type { ParcelaCreateRequest, ParcelaEstadoSync } from '@/lib/api/contracts'
import { buildParcelaDoc, findParcela, saveParcela, type ParcelaDoc } from '../repositories/parcelas'
import { getModuleSchemas, validateAgainstSchema } from '../repositories/esquemas'

/**
 * Servicio de escritura de parcelas.
 *
 * Both POST /api/parcelas and POST /api/sync go through here, so the
 * concurrency and idempotency rules live in exactly one place.
 */

export interface ParcelaWriteResult {
  id: string
  estado: ParcelaEstadoSync
  resultados: Record<string, ModuleOutcome>
  conflictos: ModuleConflict[]
  parcela?: ParcelaDoc
  error?: string
}

export interface ParcelaValidationError {
  moduleId: string
  errores: { key: string; message: string }[]
}

export class DuplicateCodigoError extends Error {
  constructor(codigo: string) {
    super(`Ya existe una parcela con el código "${codigo}".`)
    this.name = 'DuplicateCodigoError'
  }
}

const DUPLICATE_KEY = 11000

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === DUPLICATE_KEY
  )
}

/** Valida los datos de los módulos contra los esquemas publicados. */
export async function validateModuleInputs(
  updates: readonly { moduleId: string; datos: Record<string, unknown> }[],
): Promise<ParcelaValidationError[]> {
  if (updates.length === 0) return []

  const schemas = await getModuleSchemas()
  const failures: ParcelaValidationError[] = []

  for (const update of updates) {
    const errores = validateAgainstSchema(schemas.get(update.moduleId), update.datos)
    if (errores.length > 0) {
      failures.push({ moduleId: update.moduleId, errores })
    }
  }

  return failures
}

/**
 * Crea o actualiza una parcela aplicando la lógica de concurrencia por
 * módulo.
 *
 * Los campos núcleo de la parcela (nombre, ubicación, estado) son de última
 * escritura gana: son compartidos y no tienen versión propia. Los datos de
 * cada módulo sí la tienen, y ahí es donde se detectan los conflictos.
 */
export async function writeParcela(
  input: ParcelaCreateRequest,
  actor: { id: string; nombre: string },
  now: string = new Date().toISOString(),
): Promise<ParcelaWriteResult> {
  const existing = await findParcela(input.id)

  const base: Parcela = existing
    ? {
        ...existing,
        nombre: input.nombre,
        descripcion: input.descripcion,
        categoria: input.categoria,
        codigo: input.codigo,
        ubicacion: toGeoPoint(input.ubicacion),
        geometria: input.geometria,
        areaM2: input.areaM2,
        perimetroM: input.perimetroM,
        gps: { ...input.gps, fijadoEn: now },
        estado: input.estado,
        levantamientoId: input.levantamientoId,
      }
    : {
        id: input.id,
        codigo: input.codigo,
        nombre: input.nombre,
        descripcion: input.descripcion,
        categoria: input.categoria,
        ubicacion: toGeoPoint(input.ubicacion),
        geometria: input.geometria,
        areaM2: input.areaM2,
        perimetroM: input.perimetroM,
        gps: { ...input.gps, fijadoEn: now },
        estado: input.estado,
        levantamientoId: input.levantamientoId,
        modulos: {},
        version: 0,
        creadoEn: now,
        creadoPor: actor.id,
        actualizadoEn: now,
        actualizadoPor: actor.id,
      }

  const applied = applyModuleUpdates(existing?.modulos, input.modulos ?? [], actor, now)

  const doc = buildParcelaDoc({
    id: input.id,
    base,
    modulos: applied.modulos,
    actualizadoEn: now,
    actualizadoPor: actor.id,
  })

  try {
    await saveParcela(doc)
  } catch (error) {
    if (isDuplicateKeyError(error) && input.codigo) {
      throw new DuplicateCodigoError(input.codigo)
    }
    throw error
  }

  const outcomes = Object.values(applied.resultados)
  const estado: ParcelaEstadoSync = !existing
    ? 'creado'
    : applied.conflictos.length > 0
      ? 'conflicto'
      : outcomes.length > 0 && outcomes.every((outcome) => outcome === 'ignorado')
        ? 'ignorado'
        : 'actualizado'

  return {
    id: input.id,
    estado,
    resultados: applied.resultados,
    conflictos: applied.conflictos,
    parcela: doc,
  }
}
