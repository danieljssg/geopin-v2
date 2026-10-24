import type { ModuleSchema, Parcela } from './types'

/**
 * Exportadores tabulares y geográficos.
 *
 * Todo es puro: reciben parcelas y devuelven texto o bytes. La capa HTTP
 * solo los sirve. El RFC 7946 se cumple al detalle, y el CSV escapa como
 * corresponde para que un Excel no rompa la fila.
 */

export type FormatoExport = 'geojson' | 'csv' | 'xlsx'

export const FORMATOS_EXPORT: readonly FormatoExport[] = ['geojson', 'csv', 'xlsx']

/** Formatos que el plan menciona y que quedan pendientes. */
export const FORMATOS_PENDIENTES = ['shapefile'] as const

/** Columnas del núcleo, en orden fijo. */
export const COLUMNAS_NUCLEO = [
  'id',
  'codigo',
  'nombre',
  'descripcion',
  'categoria',
  'estado',
  'latitud',
  'longitud',
  'area_m2',
  'perimetro_m',
  'gps_fuente',
  'gps_precision',
  'gps_fijado_en',
  'creado_en',
  'creado_por',
  'actualizado_en',
  'actualizado_por',
] as const

export type ColumnaNucleo = (typeof COLUMNAS_NUCLEO)[number]

/**
 * Columnas de los módulos, en el orden de los esquemas.
 *
 * Se derivan del esquema publicado y no de los datos: si un campo existe en
 * el esquema pero ninguna parcela lo tiene, la columna tiene que estar igual
 * para que la planilla sea estable entre exportaciones.
 */
export function columnasDeModulos(esquemas: readonly ModuleSchema[]): string[] {
  const columnas: string[] = []

  for (const esquema of esquemas) {
    for (const campo of [...esquema.campos].sort((a, b) => a.orden - b.orden)) {
      columnas.push(`${esquema.moduleId}.${campo.key}`)
    }
  }

  return columnas
}

/** El valor de una celda de módulo, listo para exportar. */
function valorDeCampo(parcela: Parcela, moduleId: string, key: string): string | number | boolean | null {
  const valor = parcela.modulos?.[moduleId]?.datos?.[key]
  if (valor === undefined || valor === null) return null
  if (typeof valor === 'string') return valor
  if (typeof valor === 'number' || typeof valor === 'boolean') return valor
  return String(valor)
}

/** Una fila de la exportación: las columnas del núcleo más las de los módulos. */
export function filaDeParcela(
  parcela: Parcela,
  columnasModulo: readonly string[],
): Array<string | number | boolean | null> {
  const nucleo: Array<string | number | boolean | null> = [
    parcela.id,
    parcela.codigo ?? null,
    parcela.nombre,
    parcela.descripcion,
    parcela.categoria,
    parcela.estado,
    parcela.ubicacion.coordinates[1],
    parcela.ubicacion.coordinates[0],
    parcela.areaM2 ?? null,
    parcela.perimetroM ?? null,
    parcela.gps.fuente,
    parcela.gps.precision ?? null,
    parcela.gps.fijadoEn ?? null,
    parcela.creadoEn,
    parcela.creadoPor,
    parcela.actualizadoEn,
    parcela.actualizadoPor,
  ]

  const modulos = columnasModulo.map((columna) => {
    const [moduleId, key] = columna.split('.')
    return valorDeCampo(parcela, moduleId, key)
  })

  return [...nucleo, ...modulos]
}

// ---------------------------------------------------------------------------
// GeoJSON — RFC 7946
// ---------------------------------------------------------------------------

export interface GeoJsonFeature {
  type: 'Feature'
  geometry: {
    type: 'Point' | 'Polygon'
    coordinates: unknown
  }
  properties: Record<string, unknown>
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJsonFeature[]
}

/**
 * Exporta a GeoJSON complying RFC 7946.
 *
 * Los tres puntos que la norma hace obligatorios y que se incumplen seguido:
 *
 * 1. **Sin miembro `crs`.** La versión 6 de la norma quitó el `crs`: el
 *    sistema de referencia es siempre WGS 84, y ponerlo rompe la lectura en
 *    algunos visores.
 * 2. **Las coordenadas van en `[longitud, latitud]`**, al revés de como las
 *    maneja el resto de la app.
 * 3. **Los anillos exteriores van en sentido antihorario** (regla de la mano
 *    derecha). Un polígono exportado al revés se ve del lado equivocado en
 *    QGIS y en los visores web.
 */
export function toGeoJSON(
  parcelas: readonly Parcela[],
  esquemas: readonly ModuleSchema[] = [],
): GeoJsonFeatureCollection {
  const columnas = columnasDeModulos(esquemas)

  return {
    type: 'FeatureCollection',
    features: parcelas.map((parcela) => ({
      type: 'Feature',
      geometry: parcela.geometria
        ? {
            type: 'Polygon',
            coordinates: [anilloEnSentidoAntihorario(parcela.geometria.coordinates[0])],
          }
        : {
            type: 'Point',
            coordinates: [parcela.ubicacion.coordinates[0], parcela.ubicacion.coordinates[1]],
          },
      properties: {
        id: parcela.id,
        codigo: parcela.codigo ?? null,
        nombre: parcela.nombre,
        descripcion: parcela.descripcion,
        categoria: parcela.categoria,
        estado: parcela.estado,
        // La geometría es la ubicación canónica, pero repetirla en los
        // atributos hace que el archivo sirva también para las herramientas
        // que solo leen la tabla de propiedades.
        latitud: parcela.ubicacion.coordinates[1],
        longitud: parcela.ubicacion.coordinates[0],
        area_m2: parcela.areaM2 ?? null,
        perimetro_m: parcela.perimetroM ?? null,
        gps_fuente: parcela.gps.fuente,
        gps_precision: parcela.gps.precision ?? null,
        gps_fijado_en: parcela.gps.fijadoEn ?? null,
        creado_en: parcela.creadoEn,
        creado_por: parcela.creadoPor,
        actualizado_en: parcela.actualizadoEn,
        actualizado_por: parcela.actualizadoPor,
        ...objetoDeModulos(parcela, columnas),
      },
    })),
  }
}

function objetoDeModulos(
  parcela: Parcela,
  columnas: readonly string[],
): Record<string, string | number | boolean | null> {
  const resultado: Record<string, string | number | boolean | null> = {}

  for (const columna of columnas) {
    const [moduleId, key] = columna.split('.')
    resultado[columna] = valorDeCampo(parcela, moduleId, key)
  }

  return resultado
}

/**
 * Invierte el sentido de un anillo si hace falta.
 *
 * La regla de la mano derecha dice que el exterior va en sentido antihorario.
 * El área con signo lo dice: en sentido antihorario da positiva.
 */
export function anilloEnSentidoAntihorario(anillo: number[][]): number[][] {
  if (anillo.length < 4) return anillo

  let area = 0
  for (let i = 0; i < anillo.length - 1; i += 1) {
    area += anillo[i][0] * anillo[i + 1][1] - anillo[i + 1][0] * anillo[i][1]
  }

  if (area >= 0) return anillo
  return [...anillo].reverse()
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/**
 * Escapa un valor para CSV.
 *
 * El separador es la coma y el salto de línea es `\r\n`. Un valor con
 * cualquiera de los dos, o con comillas, va entrecomillado y las comillas
 * internas se duplican.
 */
export function escaparCsv(valor: string | number | boolean | null): string {
  if (valor === null || valor === undefined) return ''

  const texto = typeof valor === 'string' ? valor : String(valor)

  if (/[",\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`
  }

  return texto
}

/** Genera el CSV con BOM, para que Excel reconozca el UTF-8. */
export function toCSV(
  parcelas: readonly Parcela[],
  esquemas: readonly ModuleSchema[] = [],
): string {
  const columnasModulo = columnasDeModulos(esquemas)
  const encabezados = [...COLUMNAS_NUCLEO, ...columnasModulo]

  const lineas = [
    encabezados.map((columna) => escaparCsv(columna)).join(','),
    ...parcelas.map((parcela) =>
      filaDeParcela(parcela, columnasModulo).map(escaparCsv).join(','),
    ),
  ]

  return `﻿${lineas.join('\r\n')}\r\n`
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------

export interface HojaExport {
  nombre: string
  encabezados: string[]
  filas: Array<Array<string | number | boolean | null>>
}

/**
 * Prepara las hojas del Excel.
 *
 * La preparación es pura y la escribe la librería: así el formato de la
 * planilla se puede probar sin abrir un archivo.
 */
export function prepararHojas(
  parcelas: readonly Parcela[],
  esquemas: readonly ModuleSchema[] = [],
): HojaExport[] {
  const columnasModulo = columnasDeModulos(esquemas)
  const encabezados = [...COLUMNAS_NUCLEO, ...columnasModulo]

  return [
    {
      nombre: 'Parcelas',
      encabezados: [...encabezados],
      filas: parcelas.map((parcela) => filaDeParcela(parcela, columnasModulo)),
    },
  ]
}
