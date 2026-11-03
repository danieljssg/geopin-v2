import { headers } from 'next/headers'
import { apiRoute, jsonOk } from '@/lib/server/http'
import { requireSessionUser } from '@/lib/server/session'
import { findLevantamiento, findParcelasParaDashboard } from '@/lib/server/repositories/levantamientos'
import {
  coberturaServicios,
  densidadCeldas,
  distribucionEstados,
  equipamientoResumen,
  resumirLevantamiento,
  resumirTerritorio,
  distribucionCategorias,
  analizarCampos,
} from '@/lib/domain/dashboard'
import type { Parcela, ParcelaEstado } from '@/lib/domain/types'
import { accessibleSurvey } from '@/lib/server/survey-access'
import { filterSurveyRecords, parseSurveyFilters } from '@/lib/domain/survey-filters'

export const dynamic = 'force-dynamic'

/**
 * Datos del dashboard de un levantamiento.
 *
 * Devuelve los agregados ya calculados y los puntos del mapa. El cálculo
 * vive en `lib/domain/dashboard.ts`, que es puro y está testeado; acá solo se
 * leen las parcelas y se arma la respuesta.
 */
export async function GET(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    const user = await requireSessionUser(requestHeaders)

    const url = new URL(request.url)
    const levantamientoId = url.searchParams.get('levantamientoId')?.trim() || undefined
    if (!levantamientoId) {
      return jsonOk({ error: 'Selecciona un levantamiento para consultar el dashboard.' }, 400)
    }
    const permitido = await accessibleSurvey(user, levantamientoId)
    if (!permitido) return jsonOk({ error: 'No tienes acceso a este levantamiento.' }, 403)

    const [levantamiento, documentos] = await Promise.all([
      levantamientoId ? findLevantamiento(levantamientoId) : Promise.resolve(null),
      findParcelasParaDashboard(levantamientoId, user.role === 'encuestador' ? user.id : undefined),
    ])

    // Los documentos de Cosmos traen `_id`; el dominio no lo conoce.
    const todasParcelas = documentos.map((documento) => {
      const { _id, ...resto } = documento
      return resto as Parcela
    })
    const parcelas = filterSurveyRecords(todasParcelas, parseSurveyFilters(url.searchParams))

    const puntos = parcelas.map((parcela) => ({
      id: parcela.id,
      nombre: parcela.nombre,
      estado: parcela.estado as ParcelaEstado,
      categoria: parcela.categoria,
      lat: parcela.ubicacion.coordinates[1],
      lng: parcela.ubicacion.coordinates[0],
    }))

    return jsonOk({
      levantamiento: levantamiento
        ? {
            id: levantamiento._id,
            nombre: levantamiento.nombre,
            ciudad: levantamiento.ciudad,
            totalEsperado: levantamiento.totalEsperado,
          }
        : null,
      resumen: resumirLevantamiento(parcelas, levantamiento?.totalEsperado),
      territorio: resumirTerritorio(parcelas),
      categorias: distribucionCategorias(parcelas),
      analisis: analizarCampos(parcelas),
      distribucion: distribucionEstados(parcelas),
      cobertura: coberturaServicios(parcelas),
      equipamiento: equipamientoResumen(parcelas),
      celdas: densidadCeldas(parcelas),
      puntos,
    })
  })
}
