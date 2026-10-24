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
} from '@/lib/domain/dashboard'
import type { Parcela, ParcelaEstado } from '@/lib/domain/types'

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
    await requireSessionUser(requestHeaders)

    const url = new URL(request.url)
    const levantamientoId = url.searchParams.get('levantamientoId')?.trim() || undefined

    const [levantamiento, documentos] = await Promise.all([
      levantamientoId ? findLevantamiento(levantamientoId) : Promise.resolve(null),
      findParcelasParaDashboard(levantamientoId),
    ])

    // Los documentos de Cosmos traen `_id`; el dominio no lo conoce.
    const parcelas = documentos.map((documento) => {
      const { _id, ...resto } = documento
      return resto as Parcela
    })

    const puntos = parcelas.map((parcela) => ({
      id: parcela.id,
      nombre: parcela.nombre,
      estado: parcela.estado as ParcelaEstado,
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
      distribucion: distribucionEstados(parcelas),
      cobertura: coberturaServicios(parcelas),
      equipamiento: equipamientoResumen(parcelas),
      celdas: densidadCeldas(parcelas),
      puntos,
    })
  })
}
