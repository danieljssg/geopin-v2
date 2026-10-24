import type { ModuleSchema, Parcela } from './types'

/**
 * Exportadores tabulares y geográficos.
 *
 * Todo es puro: reciben parcelas y devuelven texto o bytes. La capa HTTP
 * solo los sirve. El RFC 7946 se cumple al detalle, y el CSV escapa como
 * corresponde para que un Excel no rompa la fila.
 */

export type FormatoExport = 'geojson' | 'csv' | 'xlsx' | 'shp'

export const FORMATOS_EXPORT: readonly FormatoExport[] = ['geojson', 'csv', 'xlsx', 'shp']

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

  return `\ufeff${lineas.join('\r\n')}\r\n`
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

// ---------------------------------------------------------------------------
// Shapefile
// ---------------------------------------------------------------------------

import {
  construirShapefile,
  empaquetarShapefile,
  type CampoShapefile,
  type PuntoShapefile,
} from './shapefile'

/**
 * Nombres de campo del Shapefile.
 *
 * La base dBase III limita los nombres a **10 caracteres**. Los nuestros son
 * más largos —`edificacion.uso_general` tiene 23—, así que se generan nombres
 * cortos y únicos. El mapeo se devuelve para que el llamador pueda
 * informar cuál es cuál.
 */
export const COLUMNAS_SHAPEFILE: ReadonlyArray<{ clave: string; nombre: string }> = [
  { clave: 'id', nombre: 'id' },
  { clave: 'codigo', nombre: 'codigo' },
  { clave: 'nombre', nombre: 'nombre' },
  { clave: 'descripcion', nombre: 'desc' },
  { clave: 'categoria', nombre: 'categoria' },
  { clave: 'estado', nombre: 'estado' },
  { clave: 'latitud', nombre: 'latitud' },
  { clave: 'longitud', nombre: 'longitud' },
  { clave: 'area_m2', nombre: 'area_m2' },
  { clave: 'perimetro_m', nombre: 'perim_m' },
  { clave: 'gps_fuente', nombre: 'gps_fuente' },
  { clave: 'gps_precision', nombre: 'gps_precis' },
  { clave: 'creado_en', nombre: 'creado_en' },
  { clave: 'actualizado_en', nombre: 'actualizado' },
  { clave: 'actualizado_por', nombre: 'actual_por' },
]

/** Genera un nombre de campo único de a lo sumo 10 caracteres. */
function nombreCorto(base: string, usados: Set<string>): string {
  const limpio = base.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 10)
  if (!usados.has(limpio)) {
    usados.add(limpio)
    return limpio
  }

  for (let i = 1; i < 100; i += 1) {
    const sufijo = `_${i}`
    const candidato = `${limpio.slice(0, 10 - sufijo.length)}${sufijo}`
    if (!usados.has(candidato)) {
      usados.add(candidato)
      return candidato
    }
  }

  return limpio
}

export interface ResultadoShapefile {
  zip: Uint8Array
  campos: CampoShapefile[]
  /** Mapeo entre el nombre corto del campo y el original. */
  mapeo: Array<{ nombre: string; original: string }>
  puntos: number
}

/**
 * Prepara el Shapefile de las parcelas.
 *
 * Devuelve el `.zip` con los cuatro archivos, los campos con sus nombres
 * cortos y el mapeo para poder documentar la equivalencia.
 */
export function prepararShapefile(
  parcelas: readonly Parcela[],
  esquemas: readonly ModuleSchema[] = [],
): ResultadoShapefile {
  const usados = new Set<string>()
  const campos: CampoShapefile[] = []
  const mapeo: Array<{ nombre: string; original: string }> = []

  for (const columna of COLUMNAS_SHAPEFILE) {
    const nombre = nombreCorto(columna.nombre, usados)
    campos.push({ nombre, tipo: 'texto' })
    mapeo.push({ nombre, original: columna.clave })
  }

  const columnasModulo = columnasDeModulos(esquemas)

  // El nombre corto se calcula UNA vez por columna: si se recalculara por
  // punto, la segunda vez devolvería otro nombre (el primero ya está en uso)
  // y los atributos no coincidirían con los campos.
  const nombresColumnas: Array<{ columna: string; nombre: string }> = []

  for (const columna of columnasModulo) {
    const nombre = nombreCorto(`m_${columna}`, usados)
    nombresColumnas.push({ columna, nombre })
    campos.push({ nombre, tipo: 'texto' })
    mapeo.push({ nombre, original: columna })
  }

  const puntos: PuntoShapefile[] = parcelas.map((parcela) => {
    const atributos: Record<string, string | number | null> = {
      id: parcela.id,
      codigo: parcela.codigo ?? '',
      nombre: parcela.nombre,
      desc: parcela.descripcion,
      categoria: parcela.categoria,
      estado: parcela.estado,
      latitud: parcela.ubicacion.coordinates[1],
      longitud: parcela.ubicacion.coordinates[0],
      area_m2: parcela.areaM2 ?? null,
      perim_m: parcela.perimetroM ?? null,
      gps_fuente: parcela.gps.fuente,
      gps_precis: parcela.gps.precision ?? null,
      creado_en: parcela.creadoEn,
      actualizado: parcela.actualizadoEn,
      actual_por: parcela.actualizadoPor,
    }

    for (const { columna, nombre } of nombresColumnas) {
      const [moduleId, clave] = columna.split('.')
      const valor = parcela.modulos?.[moduleId]?.datos?.[clave]
      atributos[nombre] = valor === undefined ? null : String(valor)
    }

    return { x: parcela.ubicacion.coordinates[0], y: parcela.ubicacion.coordinates[1], atributos }
  })

  return { zip: empaquetarShapefile(construirShapefile(puntos, campos)), campos, mapeo, puntos: puntos.length }
}
