import { headers } from 'next/headers'
import { parseParcelaPatch } from '@/lib/api/contracts'
import { apiRoute, jsonError, jsonOk, readJsonBody } from '@/lib/server/http'
import { requirePermission, requireSessionUser } from '@/lib/server/session'
import { deleteParcela, findParcela } from '@/lib/server/repositories/parcelas'
import { applyModuleUpdates } from '@/lib/domain/sync'
import { toGeoPoint } from '@/lib/domain/parcela'
import { buildParcelaDoc, saveParcela } from '@/lib/server/repositories/parcelas'
import {
  DuplicateCodigoError,
  validateModuleInputs,
} from '@/lib/server/services/parcelas'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    await requireSessionUser(requestHeaders)

    const { id } = await context.params
    const parcela = await findParcela(id)
    if (!parcela) return jsonError('La parcela no existe.', 404)

    return jsonOk({ parcela })
  })
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requirePermission(requestHeaders, 'parcela:editar')

    const { id } = await context.params
    const existing = await findParcela(id)
    if (!existing) return jsonError('La parcela no existe.', 404)

    const raw = await readJsonBody(request)
    const parsed = parseParcelaPatch(raw)
    if (!parsed.ok) return jsonError(parsed.error, 400)

    const failures = await validateModuleInputs(parsed.value.modulos ?? [])
    if (failures.length > 0) {
      return jsonError(
        failures
          .map((failure) => `${failure.moduleId}: ${failure.errores.map((e) => e.message).join(' ')}`)
          .join(' | '),
        422,
      )
    }

    const now = new Date().toISOString()
    const core = parsed.value.core

    const base = {
      ...existing,
      ...(core?.nombre !== undefined ? { nombre: core.nombre } : {}),
      ...(core?.descripcion !== undefined ? { descripcion: core.descripcion } : {}),
      ...(core?.categoria !== undefined ? { categoria: core.categoria } : {}),
      ...(core?.codigo !== undefined ? { codigo: core.codigo } : {}),
      ...(core?.ubicacion !== undefined ? { ubicacion: toGeoPoint(core.ubicacion) } : {}),
      ...(core?.gps !== undefined ? { gps: { ...core.gps, fijadoEn: now } } : {}),
      ...(core?.estado !== undefined ? { estado: core.estado } : {}),
      ...(core?.levantamientoId !== undefined ? { levantamientoId: core.levantamientoId } : {}),
      ...(core?.geometria !== undefined ? { geometria: core.geometria } : {}),
      ...(core?.areaM2 !== undefined ? { areaM2: core.areaM2 } : {}),
      ...(core?.perimetroM !== undefined ? { perimetroM: core.perimetroM } : {}),
    }

    const applied = applyModuleUpdates(
      existing.modulos,
      parsed.value.modulos ?? [],
      { id: user.id, nombre: user.name },
      now,
    )

    const doc = buildParcelaDoc({
      id,
      base,
      modulos: applied.modulos,
      actualizadoEn: now,
      actualizadoPor: user.id,
    })

    try {
      await saveParcela(doc)
    } catch (error) {
      if (error instanceof DuplicateCodigoError) return jsonError(error.message, 409)
      throw error
    }

    const body = {
      parcela: doc,
      resultados: applied.resultados,
      conflictos: applied.conflictos,
    }

    // Hay conflicto en algún módulo: se devuelve 409 con el estado actual
    // para que la app muestre la diferencia. Los módulos que no chocaron ya
    // quedaron aplicados.
    return applied.conflictos.length > 0 ? jsonOk(body, 409) : jsonOk(body)
  })
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requirePermission(requestHeaders, 'parcela:eliminar')

    const { id } = await context.params
    const existing = await findParcela(id)
    if (!existing) return jsonError('La parcela no existe.', 404)

    // Un administrador borra lo que sea; un encuestador solo lo que él creó.
    if (user.role !== 'admin' && existing.creadoPor !== user.id) {
      return jsonError('Solo podés eliminar las parcelas que creaste.', 403)
    }

    await deleteParcela(id)
    return jsonOk({ eliminada: true })
  })
}
