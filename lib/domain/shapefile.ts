/**
 * Escritor de Shapefile.
 *
 * El formato es binario y tiene cuatro archivos: `.shp` (geometría), `.shx`
 * (índice), `.dbf` (atributos) y `.prj` (sistema de referencia). Se
 * empaquetan en un `.zip`, que es como los consume QGIS y ArcGIS.
 *
 * Solo se implementa el tipo de geometría **Point**, que es el que necesita
 * el proyecto: las parcelas son puntos con sus atributos. Un polígono en
 * Shapefile es un `Polygon` con su propia estructura de partes y anillos, y
 * sumarlo sin necesidad sería una fuente de bugs.
 *
 * Todo es puro y sin dependencias: devuelve `Uint8Array`, y el route handler
 * lo sirve.
 */

export interface PuntoShapefile {
  x: number
  y: number
  atributos: Record<string, string | number | boolean | null | undefined>
}

export type TipoCampoShapefile = 'texto' | 'numero'

export interface CampoShapefile {
  nombre: string
  tipo: TipoCampoShapefile
  /** Longitud máxima del campo de texto. */
  longitud?: number
}

export interface ArchivosShapefile {
  shp: Uint8Array
  shx: Uint8Array
  dbf: Uint8Array
  prj: Uint8Array
}

/** Código de archivo del formato Shapefile. */
const FILE_CODE = 9994
/** Versión del formato. */
const VERSION = 1000
/** Tipo de geometría: punto. */
const SHAPE_TYPE_POINT = 1
/** Longitud de la cabecera, en bytes. */
const HEADER_LENGTH = 100
/** Bytes que ocupa un registro de punto: 4 de tipo + 8 de X + 8 de Y. */
const POINT_CONTENT_LENGTH = 20
/** Bytes del encabezado de la base dBase. */
const DBF_HEADER_LENGTH = 32

/** WKT de WGS 84, que es el sistema de referencia del RFC 7946. */
export const PRJ_WGS84 =
  'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],' +
  'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'

// ---------------------------------------------------------------------------
// Escritor de bytes
// ---------------------------------------------------------------------------

class Escritor {
  private partes: number[] = []

  byte(valor: number): void {
    this.partes.push(valor & 0xff)
  }

  uint16LE(valor: number): void {
    this.partes.push(valor & 0xff, (valor >>> 8) & 0xff)
  }

  uint32LE(valor: number): void {
    this.partes.push(
      valor & 0xff,
      (valor >>> 8) & 0xff,
      (valor >>> 16) & 0xff,
      (valor >>> 24) & 0xff,
    )
  }

  uint16BE(valor: number): void {
    this.partes.push((valor >>> 8) & 0xff, valor & 0xff)
  }

  uint32BE(valor: number): void {
    this.partes.push(
      (valor >>> 24) & 0xff,
      (valor >>> 16) & 0xff,
      (valor >>> 8) & 0xff,
      valor & 0xff,
    )
  }

  doubleLE(valor: number): void {
    const buffer = new ArrayBuffer(8)
    new DataView(buffer).setFloat64(0, valor, true)
    for (const byte of new Uint8Array(buffer)) this.partes.push(byte)
  }

  bytes(valores: Uint8Array): void {
    for (const byte of valores) this.partes.push(byte)
  }

  texto(texto: string, longitud: number): void {
    const limpio = texto.slice(0, longitud)
    for (let i = 0; i < longitud; i += 1) {
      this.partes.push(i < limpio.length ? limpio.charCodeAt(i) & 0x7f : 0x20)
    }
  }

  get longitud(): number {
    return this.partes.length
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.partes)
  }
}

// ---------------------------------------------------------------------------
// CRC32, que el ZIP necesita
// ---------------------------------------------------------------------------

let tablaCRC: Uint32Array | null = null

function tabla(): Uint32Array {
  if (tablaCRC) return tablaCRC

  const nueva = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let c = i
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    nueva[i] = c >>> 0
  }

  tablaCRC = nueva
  return nueva
}

export function crc32(datos: Uint8Array): number {
  const t = tabla()
  let crc = 0xffffffff

  for (const byte of datos) {
    crc = t[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

// ---------------------------------------------------------------------------
// .shp y .shx
// ---------------------------------------------------------------------------

function escribirShp(puntos: readonly PuntoShapefile[]): Uint8Array {
  const escritor = new Escritor()

  const xMin = puntos.length > 0 ? Math.min(...puntos.map((p) => p.x)) : 0
  const yMin = puntos.length > 0 ? Math.min(...puntos.map((p) => p.y)) : 0
  const xMax = puntos.length > 0 ? Math.max(...puntos.map((p) => p.x)) : 0
  const yMax = puntos.length > 0 ? Math.max(...puntos.map((p) => p.y)) : 0

  const contentLength = POINT_CONTENT_LENGTH
  const totalBytes = HEADER_LENGTH + puntos.length * (8 + contentLength)

  escritor.uint32BE(FILE_CODE)
  escritor.uint32BE(totalBytes / 2)
  escritor.uint32LE(VERSION)
  escritor.uint32LE(SHAPE_TYPE_POINT)
  escritor.doubleLE(xMin)
  escritor.doubleLE(yMin)
  escritor.doubleLE(xMax)
  escritor.doubleLE(yMax)
  escritor.doubleLE(0)
  escritor.doubleLE(0)
  escritor.doubleLE(0)
  escritor.doubleLE(0)
  // Contador de registros y los cuatro reservados: la cabecera son 100 bytes.
  for (let i = 0; i < 5; i += 1) escritor.uint32BE(0)

  puntos.forEach((punto, indice) => {
    escritor.uint32BE(indice + 1)
    escritor.uint32BE(contentLength / 2)
    escritor.uint32LE(SHAPE_TYPE_POINT)
    escritor.doubleLE(punto.x)
    escritor.doubleLE(punto.y)
  })

  return escritor.toUint8Array()
}

function escribirShx(puntos: readonly PuntoShapefile[]): Uint8Array {
  const escritor = new Escritor()

  const contentLength = POINT_CONTENT_LENGTH
  const totalBytes = HEADER_LENGTH + puntos.length * 8

  escritor.uint32BE(FILE_CODE)
  escritor.uint32BE(totalBytes / 2)
  escritor.uint32LE(VERSION)
  escritor.uint32LE(SHAPE_TYPE_POINT)

  // Los límites del .shx no importan: el índice solo guarda desplazamientos.
  for (let i = 0; i < 8; i += 1) escritor.doubleLE(0)
  // Contador de registros y los cuatro reservados: la cabecera son 100 bytes.
  for (let i = 0; i < 5; i += 1) escritor.uint32BE(0)

  puntos.forEach((_, indice) => {
    // El desplazamiento va en palabras de 16 bits desde el inicio del archivo.
    escritor.uint32BE((HEADER_LENGTH + indice * (8 + contentLength)) / 2)
    escritor.uint32BE(contentLength / 2)
  })

  return escritor.toUint8Array()
}

// ---------------------------------------------------------------------------
// .dbf
// ---------------------------------------------------------------------------

function valorComoTexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'boolean') return valor ? 'T' : 'F'
  return String(valor)
}

/** Formatea un número con los decimales fijos que pide el campo dBase. */
function valorComoNumero(valor: unknown, longitud: number, decimales: number): string {
  if (valor === null || valor === undefined || valor === '') {
    return ' '.repeat(longitud)
  }

  const numero = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(numero)) return ' '.repeat(longitud)

  return numero.toFixed(decimales).padStart(longitud, ' ')
}

function escribirDbf(
  puntos: readonly PuntoShapefile[],
  campos: readonly CampoShapefile[],
): Uint8Array {
  const textos = campos.map((campo) => {
    if (campo.tipo === 'texto') {
      const largos = puntos.map((punto) => valorComoTexto(punto.atributos[campo.nombre]).length)
      const longitud = Math.min(Math.max(campo.longitud ?? 0, ...largos, 1), 254)
      return { ...campo, longitud }
    }
    return { ...campo, longitud: 18, decimales: 6 }
  })

  const largoRegistro = 1 + textos.reduce((suma, campo) => suma + campo.longitud, 0)
  const largoCabecera = DBF_HEADER_LENGTH * (textos.length + 1) + 1

  const escritor = new Escritor()
  const ahora = new Date()

  escritor.byte(0x03) // dBase III sin marcador memo
  escritor.byte(ahora.getFullYear() - 1900)
  escritor.byte(ahora.getMonth() + 1)
  escritor.byte(ahora.getDate())
  escritor.uint32LE(puntos.length)
  escritor.uint16LE(largoCabecera)
  escritor.uint16LE(largoRegistro)
  for (let i = 0; i < 20; i += 1) escritor.byte(0)

  for (const campo of textos) {
    const nombre = campo.nombre.slice(0, 10)
    escritor.texto(nombre, 11)
    escritor.byte(campo.tipo === 'texto' ? 0x43 : 0x4e) // 'C' o 'N'
    for (let i = 0; i < 4; i += 1) escritor.byte(0)
    escritor.byte(campo.longitud)
    escritor.byte(campo.tipo === 'texto' ? 0 : (campo as { decimales?: number }).decimales ?? 6)
    for (let i = 0; i < 14; i += 1) escritor.byte(0)
  }

  escritor.byte(0x0d) // fin de los descriptores

  for (const punto of puntos) {
    escritor.byte(0x20) // registro activo
    for (const campo of textos) {
      const valor = punto.atributos[campo.nombre]
      if (campo.tipo === 'texto') {
        escritor.texto(valorComoTexto(valor), campo.longitud)
      } else {
        escritor.texto(
          valorComoNumero(valor, campo.longitud, (campo as { decimales?: number }).decimales ?? 6),
          campo.longitud,
        )
      }
    }
  }

  escritor.byte(0x1a) // fin de archivo

  return escritor.toUint8Array()
}

// ---------------------------------------------------------------------------
// ZIP
// ---------------------------------------------------------------------------

export interface ArchivoZip {
  nombre: string
  datos: Uint8Array
}

/**
 * Empaqueta archivos en un ZIP sin comprimir.
 *
 * El método "store" es válido para ZIP y lo leen todas las herramientas. Un
 * shapefile son unos cientos de KB: comprimirlo con DEFLATE daría un
 * ahorro marginal a cambio de implementar el algoritmo de compresión.
 */
export function construirZip(archivos: readonly ArchivoZip[]): Uint8Array {
  const escritor = new Escritor()
  const centrales: number[] = []
  const fecha = new Date()

  // Fecha y hora en el formato de MS-DOS.
  const hora = (fecha.getHours() << 11) | (fecha.getMinutes() << 5) | (fecha.getSeconds() >> 1)
  const dia = ((fecha.getFullYear() - 1980) << 9) | ((fecha.getMonth() + 1) << 5) | fecha.getDate()

  for (const archivo of archivos) {
    const offset = escritor.longitud
    const nombre = new TextEncoder().encode(archivo.nombre)
    const crc = crc32(archivo.datos)

    escritor.uint32LE(0x04034b50)
    escritor.uint16LE(20)
    escritor.uint16LE(0)
    escritor.uint16LE(0)
    escritor.uint16LE(hora)
    escritor.uint16LE(dia)
    escritor.uint32LE(crc)
    escritor.uint32LE(archivo.datos.length)
    escritor.uint32LE(archivo.datos.length)
    escritor.uint16LE(nombre.length)
    escritor.uint16LE(0)
    escritor.bytes(nombre)
    escritor.bytes(archivo.datos)

    centrales.push(offset, crc, archivo.datos.length, nombre.length)
    centrales.push(nombre.length)
  }

  const inicioCentral = escritor.longitud

  for (const archivo of archivos) {
    const offset = centrales[centrales.length - 6]
    const crc = centrales[centrales.length - 5]
    const tamano = centrales[centrales.length - 4]
    const nombre = new TextEncoder().encode(archivo.nombre)

    escritor.uint32LE(0x02014b50)
    escritor.uint16LE(20)
    escritor.uint16LE(20)
    escritor.uint16LE(0)
    escritor.uint16LE(0)
    escritor.uint16LE(hora)
    escritor.uint16LE(dia)
    escritor.uint32LE(crc)
    escritor.uint32LE(tamano)
    escritor.uint32LE(tamano)
    escritor.uint16LE(nombre.length)
    escritor.uint16LE(0)
    escritor.uint16LE(0)
    escritor.uint16LE(0)
    escritor.uint16LE(0)
    escritor.uint32LE(0)
    escritor.uint32LE(offset)
    escritor.bytes(nombre)
  }

  const tamanoCentral = escritor.longitud - inicioCentral

  escritor.uint32LE(0x06054b50)
  escritor.uint16LE(0)
  escritor.uint16LE(0)
  escritor.uint16LE(archivos.length)
  escritor.uint16LE(archivos.length)
  escritor.uint32LE(tamanoCentral)
  escritor.uint32LE(inicioCentral)
  escritor.uint16LE(0)

  return escritor.toUint8Array()
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Construye los cuatro archivos de un shapefile de puntos.
 *
 * Los nombres de campo del shapefile están limitados a 10 caracteres: es el
 * formato de la base dBase III, no una limitación de QGIS. Los nombres largos
 * se truncan, pero el `nombre` original queda en el `.dbf`? No: el `.dbf` es
 * el único que lleva los nombres de campo, así que se truncan ahí y el
 * exportador informa cuáles quedaron cortados.
 */
export function construirShapefile(
  puntos: readonly PuntoShapefile[],
  campos: readonly CampoShapefile[],
): ArchivosShapefile {
  return {
    shp: escribirShp(puntos),
    shx: escribirShx(puntos),
    dbf: escribirDbf(puntos, campos),
    prj: new TextEncoder().encode(PRJ_WGS84),
  }
}

/** Empaqueta los cuatro archivos en el `.zip` que se descarga. */
export function empaquetarShapefile(archivos: ArchivosShapefile): Uint8Array {
  return construirZip([
    { nombre: 'parcelas.shp', datos: archivos.shp },
    { nombre: 'parcelas.shx', datos: archivos.shx },
    { nombre: 'parcelas.dbf', datos: archivos.dbf },
    { nombre: 'parcelas.prj', datos: archivos.prj },
  ])
}

/** Nombres de campo que quedan más largos de lo que permite el formato. */
export function camposTruncados(campos: readonly CampoShapefile[]): string[] {
  return campos.filter((campo) => campo.nombre.length > 10).map((campo) => campo.nombre)
}
