import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import type { Parcela } from './types'

/**
 * Importación de archivos de campo.
 *
 * Los levantadores entregan Excel o CSV con las columnas que/usaron en la
 * planilla, no con las nuestras. Todo el trabajo de entender ese archivo es
 * mappings y reglas, así que vive en un módulo puro y se prueba con casos
 * concretos.
 */

/**
 * Normaliza un encabezado para poder compararlo.
 *
 * "Metros Cuadrados (m²)" y "metros_cuadrados" tienen que terminar siendo la
 * misma columna: minúsculas, sin acentos, sin puntuación y con guiones
 * bajos en lugar de espacios.
 */
export function normalizarEncabezado(encabezado: string): string {
  return encabezado
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Los superíndices y el ordinal masculino son habituales en las planillas
    // de campo ("m²", "nº") y la limpieza los borraría: "m²" terminaría
    // siendo "m" y no se reconocería como área.
    .replace(/[¹]/g, '1')
    .replace(/[²]/g, '2')
    .replace(/[³]/g, '3')
    .replace(/[ºª]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Alias aceptados por cada campo.
 *
 * El primer nombre de cada lista es el canónico y es el que se usa de vuelta
 * en el archivo exportado, así que la exportación y la importación son
 * inversas.
 */
export const ALIAS_CAMPOS: Record<string, string[]> = {
  id: ['id'],
  codigo: ['codigo', 'codigo_catastro', 'clave_catastral', 'referencia_catastral'],
  nombre: ['nombre', 'nombre_parcela', 'referencia', 'descripcion_corta'],
  descripcion: ['descripcion', 'observaciones', 'notas', 'observacion_campo'],
  categoria: ['categoria', 'tipo', 'tipo_parcela'],
  estado: ['estado'],
  latitud: ['latitud', 'lat', 'latitude'],
  longitud: ['longitud', 'lng', 'lon', 'long', 'longitude'],
  area_m2: ['area_m2', 'area', 'metros_cuadrados', 'm2', 'superficie_m2'],
  perimetro_m: ['perimetro_m', 'perimetro', 'metros_lineales'],
  gps_fuente: ['gps_fuente', 'origen_posicion', 'fuente_gps'],
  gps_precision: ['gps_precision', 'precision', 'precision_gps'],
  modulacion: ['modulacion', 'modulo', 'observaciones_modulo'],
}

export interface MapeoEncabezados {
  /** Columna del archivo → campo canónico. */
  mapa: Record<string, string>
  /** Columnas del archivo que no se reconocieron. */
  desconocidas: string[]
}

/**
 * Resuelve qué columna del archivo corresponde a qué campo.
 *
 * Las columnas que no se reconocen no son un error: un archivo de campo
 * puede traer columnas de control que no nos interesan. Se ignoran y se
 * avisan.
 */
export function mapearEncabezados(encabezados: readonly string[]): MapeoEncabezados {
  const mapa: Record<string, string> = {}
  const desconocidas: string[] = []
  const camposAsignados = new Set<string>()

  for (const encabezado of encabezados) {
    const normalizado = normalizarEncabezado(encabezado)
    if (normalizado === '') continue

    const encontrado = Object.entries(ALIAS_CAMPOS).find(([, alias]) =>
      alias.some((nombre) => normalizarEncabezado(nombre) === normalizado),
    )

    if (!encontrado) {
      desconocidas.push(encabezado)
      continue
    }

    const [campo] = encontrado

    // La primera columna que coincide gana: si el archivo trae "Área" y
    // "Área (m²)", gana la que aparezca primero.
    if (camposAsignados.has(campo)) continue

    camposAsignados.add(campo)
    mapa[encabezado] = campo
  }

  return { mapa, desconocidas }
}

/** Convierte el valor de una celda de planilla a número, si se puede. */
function aNumero(valor: unknown): number | undefined {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor !== 'string') return undefined

  const limpio = valor.trim().replace(',', '.')
  if (limpio === '') return undefined

  const numero = Number(limpio)
  return Number.isFinite(numero) ? numero : undefined
}

/** Convierte el valor de una celda a texto limpio. */
function aTexto(valor: unknown): string | undefined {
  if (valor === null || valor === undefined) return undefined
  if (typeof valor === 'string') {
    const limpio = valor.trim()
    return limpio === '' ? undefined : limpio
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') return String(valor)
  return undefined
}

export interface ResultadoFila {
  fila: number
  errores: string[]
  /** Datos ya mapeados a campos canónicos. */
  datos: Record<string, unknown>
}

/**
 * Convierte una fila de la planilla en datos canónicos.
 *
 * La fila se indexa desde 2: la primera es el encabezado y los_archivos
 * Excel suelen traer una fila de título antes.
 */
export function mapearFila(
  fila: Record<string, unknown>,
  mapa: Record<string, string>,
  numeroFila: number,
): ResultadoFila {
  const datos: Record<string, unknown> = {}
  const errores: string[] = []

  for (const [columna, campo] of Object.entries(mapa)) {
    const valor = fila[columna]

    if (campo === 'latitud' || campo === 'longitud' || campo === 'area_m2' || campo === 'perimetro_m' || campo === 'gps_precision') {
      const numero = aNumero(valor)
      if (numero === undefined) {
        if (valor !== undefined && valor !== null && String(valor).trim() !== '') {
          errores.push(`"${columna}" no es un número válido.`)
        }
        continue
      }
      datos[campo] = numero
      continue
    }

    const texto = aTexto(valor)
    if (texto !== undefined) datos[campo] = texto
  }

  return { fila: numeroFila, errores, datos }
}

export interface ConversionFila {
  fila: number
  errores: string[]
  /** La parcela que se crearía o actualizaría. */
  parcela?: Omit<ParcelaCreateRequest, 'id'>
}

/**
 * Convierte una fila mapeada en los datos de una parcela.
 *
 * El id **no** se genera acá: la idempotencia de la importación la da el
 * código de parcela. Si el código viene vacío, la fila no se puede importar
 * y se reporta.
 */
export function filaAParcela(
  datos: Record<string, unknown>,
  numeroFila: number,
  erroresPrevios: readonly string[] = [],
): ConversionFila {
  const errores = [...erroresPrevios]

  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : ''
  if (nombre === '') errores.push('Falta el nombre de la parcela.')

  const latitud = typeof datos.latitud === 'number' ? datos.latitud : undefined
  const longitud = typeof datos.longitud === 'number' ? datos.longitud : undefined

  if (latitud === undefined || longitud === undefined) {
    errores.push('Faltan las coordenadas.')
  } else if (latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180) {
    errores.push('Las coordenadas están fuera de rango.')
  }

  const codigo = typeof datos.codigo === 'string' ? datos.codigo.trim() : ''

  /**
   * El código de parcela es **obligatorio** en una importación.
   *
   * La idempotencia de la importación se apoya en el código: es la
   * identidad catastral que permite reconocer la misma parcela en dos
   * archivos de dos levantadores. Una fila sin código no se puede
   * deduplicar nunca, y reimportar el mismo archivo la volvería a crear
   * como una parcela distinta. Es mejor que la importación la rechace.
   */
  if (codigo === '') {
    errores.push('Falta el código de parcela. Sin código no se puede deduplicar la importación.')
  }

  if (errores.length > 0) return { fila: numeroFila, errores }

  return {
    fila: numeroFila,
    errores: [],
    parcela: {
      nombre,
      descripcion: typeof datos.descripcion === 'string' ? datos.descripcion : '',
      categoria: typeof datos.categoria === 'string' && datos.categoria.trim() !== ''
        ? datos.categoria.trim()
        : 'Vivienda',
      codigo: codigo === '' ? undefined : codigo,
      ubicacion: { lat: latitud!, lng: longitud! },
      gps: {
        fuente: datos.gps_fuente === 'manual' ? 'manual' : 'sensor',
        precision: typeof datos.gps_precision === 'number' ? datos.gps_precision : undefined,
      },
      estado: datos.estado === 'completa' || datos.estado === 'en_revision' ? datos.estado : 'pendiente',
      areaM2: typeof datos.area_m2 === 'number' ? datos.area_m2 : undefined,
      perimetroM: typeof datos.perimetro_m === 'number' ? datos.perimetro_m : undefined,
      modulos: [],
    },
  }
}

/**
 * Clave de idempotencia de una fila importada.
 *
 * Es el código de parcela. Si no tiene código, la fila no es idempotente: no
 * se puede importar de forma segura, porque un segundo archivo con la misma
 * fila crearía otra parcela.
 */
export function claveDeIdempotencia(codigo: string | undefined): string | null {
  if (!codigo) return null
  const limpio = codigo.trim().toUpperCase()
  return limpio === '' ? null : limpio
}

/** Compara dos parcels por código, ignorando mayúsculas y espacios. */
export function mismoCodigo(a: string | undefined, b: string | undefined): boolean {
  const claveA = claveDeIdempotencia(a)
  const claveB = claveDeIdempotencia(b)
  return claveA !== null && claveA === claveB
}

/** Extrae el código de una parcela ya guardada. */
export function codigoDe(parcela: Pick<Parcela, 'codigo'>): string | null {
  return claveDeIdempotencia(parcela.codigo)
}
