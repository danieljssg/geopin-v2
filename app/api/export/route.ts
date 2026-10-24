import { headers } from 'next/headers'
import * as XLSX from 'xlsx'
import { apiRoute, jsonError } from '@/lib/server/http'
import { requireSessionUser } from '@/lib/server/session'
import { findParcelasParaDashboard } from '@/lib/server/repositories/levantamientos'
import { getModuleSchemas } from '@/lib/server/repositories/esquemas'
import {
  FORMATOS_EXPORT,
  prepararHojas,
  prepararShapefile,
  toCSV,
  toGeoJSON,
  type FormatoExport,
} from '@/lib/domain/export'
import type { Parcela } from '@/lib/domain/types'

export const dynamic = 'force-dynamic'

/**
 * Exportación de las parcelas en formatos estándar.
 *
 * Sale del servidor, no del dispositivo: el archivo tiene que incluir todo el
 * levantamiento, no lo que el navegador de quien exporta tiene en su cache.
 */

const TIPOS: Record<FormatoExport, { contentType: string; extension: string }> = {
  geojson: { contentType: 'application/geo+json; charset=utf-8', extension: 'geojson' },
  csv: { contentType: 'text/csv; charset=utf-8', extension: 'csv' },
  xlsx: {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  },
  shp: { contentType: 'application/zip', extension: 'zip' },
}

export async function GET(request: Request): Promise<Response> {
  return apiRoute(async () => {
    const requestHeaders = await headers()
    await requireSessionUser(requestHeaders)

    const url = new URL(request.url)
    const formato = url.searchParams.get('format') ?? 'geojson'

    if (!FORMATOS_EXPORT.includes(formato as FormatoExport)) {
      return jsonError(
        `Formato "${formato}" no soportado. Disponibles: ${FORMATOS_EXPORT.join(', ')}.`,
        400,
      )
    }

    const levantamientoId = url.searchParams.get('levantamientoId')?.trim() || undefined

    const [documentos, esquemas] = await Promise.all([
      findParcelasParaDashboard(levantamientoId),
      getModuleSchemas(),
    ])

    const parcelas = documentos.map((documento) => {
      const { _id, ...resto } = documento
      return resto as unknown as Parcela
    })

    const listaEsquemas = [...esquemas.values()]
    const marca = new Date().toISOString().split('T')[0]
    const sufijo = levantamientoId ? `-${levantamientoId.slice(0, 8)}` : ''

    if (formato === 'geojson') {
      const geojson = JSON.stringify(toGeoJSON(parcelas, listaEsquemas), null, 2)
      return new Response(geojson, {
        headers: {
          'Content-Type': TIPOS.geojson.contentType,
          'Content-Disposition': `attachment; filename="parcelas${sufijo}-${marca}.geojson"`,
        },
      })
    }

    if (formato === 'csv') {
      return new Response(toCSV(parcelas, listaEsquemas), {
        headers: {
          'Content-Type': TIPOS.csv.contentType,
          'Content-Disposition': `attachment; filename="parcelas${sufijo}-${marca}.csv"`,
        },
      })
    }

    if (formato === 'shp') {
      const shapefile = prepararShapefile(parcelas, listaEsquemas)

      return new Response(shapefile.zip as unknown as BodyInit, {
        headers: {
          'Content-Type': TIPOS.shp.contentType,
          'Content-Disposition': `attachment; filename="parcelas${sufijo}-${marca}.zip"`,
        },
      })
    }

    const hoja = prepararHojas(parcelas, listaEsquemas)[0]
    // `aoa_to_sheet` y no `json_to_sheet`: la hoja tiene que llevar la fila de
    // encabezados, que es la que define el orden de las columnas.
    const matriz = [hoja.encabezados, ...hoja.filas]
    const libro = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(matriz), hoja.nombre)

    const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' })

    return new Response(buffer, {
      headers: {
        'Content-Type': TIPOS.xlsx.contentType,
        'Content-Disposition': `attachment; filename="parcelas${sufijo}-${marca}.xlsx"`,
      },
    })
  })
}
