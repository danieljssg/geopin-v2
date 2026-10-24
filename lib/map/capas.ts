/**
 * Configuración de las capas del mapa.
 *
 * Hay dos clases: las **base**, que se muestran de a una (el fondo), y las
 * **superposiciones**, que se apilan encima con su propia opacidad —que es
 * como se superpone una ortofoto sin tapar los nombres de las calles.
 *
 * Las superposiciones se configuran por variable de entorno del servidor, no
 * del cliente: cambiarlas no debería obligar a recompilar la app.
 */

export type TipoCapa = 'base' | 'superposicion'

export interface CapaMapa {
  id: string
  label: string
  tipo: TipoCapa
  /** Plantilla XYZ o URL del servicio WMS. */
  url: string
  attribution: string
  /** Opacidad inicial, de 0 a 1. */
  opacity: number
  /** Capa del servicio WMS, separada por comas si hay varias. */
  wmsLayers?: string
  /** Permite pedir información de la capa al hacer clic. */
  consultable?: boolean
}

export const OPACIDAD_MINIMA = 0.1
export const OPACIDAD_MAXIMA = 1

/** Fuentes base que siempre están disponibles. */
export function capasBasePorDefecto(baseUrlPropio: string): CapaMapa[] {
  const propias: CapaMapa[] = []

  if (baseUrlPropio) {
    propias.push({
      id: 'propio',
      label: 'Mapa del levantamiento',
      tipo: 'base',
      url: `${baseUrlPropio.replace(/\/$/, '')}/{z}/{x}/{y}.png`,
      attribution: 'Levantamiento propio',
      opacity: 1,
    })
  }

  return [
    ...propias,
    {
      id: 'osm',
      label: 'Mapa estándar',
      tipo: 'base',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      opacity: 1,
    },
    {
      id: 'topo',
      label: 'Mapa topográfico (relieve)',
      tipo: 'base',
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution:
        'Kartendaten: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende, SRTM | Kartendarstellung: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
      opacity: 1,
    },
  ]
}

/**
 * Lee las superposiciones desde una variable de entorno con un JSON.
 *
 * Devuelve un error legible en vez de fallar: una variable mal formada
 * rompe el mapa entero, y es mejor que la app siga funcionando con las capas
 * base y avise de lo que pasó.
 */
export function parsearCapasSuperpuestas(
  json: string | undefined,
): { capas: CapaMapa[]; error?: string } {
  if (!json || json.trim() === '') return { capas: [] }

  let datos: unknown
  try {
    datos = JSON.parse(json)
  } catch {
    return { capas: [], error: 'CAPAS_SUPERPUESTAS no es un JSON válido.' }
  }

  if (!Array.isArray(datos)) {
    return { capas: [], error: 'CAPAS_SUPERPUESTAS tiene que ser una lista.' }
  }

  const capas: CapaMapa[] = []
  const errores: string[] = []
  const vistos = new Set<string>()

  for (const [indice, item] of datos.entries()) {
    if (typeof item !== 'object' || item === null) {
      errores.push(`La capa ${indice + 1} no es un objeto.`)
      continue
    }

    const capa = item as Record<string, unknown>
    const id = typeof capa.id === 'string' ? capa.id.trim() : ''
    const label = typeof capa.label === 'string' ? capa.label.trim() : ''
    const url = typeof capa.url === 'string' ? capa.url.trim() : ''

    if (!id || !label || !url) {
      errores.push(`La capa ${indice + 1} necesita id, label y url.`)
      continue
    }
    if (vistos.has(id)) {
      errores.push(`La capa "${id}" está repetida.`)
      continue
    }
    vistos.add(id)

    const opacidad = typeof capa.opacity === 'number' ? capa.opacity : 0.8

    capas.push({
      id,
      label,
      tipo: 'superposicion',
      url,
      attribution: typeof capa.attribution === 'string' ? capa.attribution : '',
      opacity: Math.min(Math.max(opacidad, OPACIDAD_MINIMA), OPACIDAD_MAXIMA),
      wmsLayers: typeof capa.wmsLayers === 'string' ? capa.wmsLayers : undefined,
      consultable: capa.consultable === true,
    })
  }

  return {
    capas,
    error: errores.length > 0 ? errores.join(' ') : undefined,
  }
}

/** Todas las capas, base primero. */
export function todasLasCapas(
  baseUrlPropio: string,
  superpuestas: readonly CapaMapa[],
): CapaMapa[] {
  return [...capasBasePorDefecto(baseUrlPropio), ...superpuestas]
}

/** Las capas de un tipo. */
export function capasDeTipo(capas: readonly CapaMapa[], tipo: TipoCapa): CapaMapa[] {
  return capas.filter((capa) => capa.tipo === tipo)
}

/**
 * Valida una configuración de capas.
 *
 * Lo que no se puede validar desde el código —que el WMS exista y sirva esa
 * capa— se comprueba en runtime cuando Leaflet la pide.
 */
export function validarCapas(capas: readonly CapaMapa[]): string[] {
  const errores: string[] = []
  const ids = new Set<string>()

  for (const capa of capas) {
    if (!capa.id) errores.push('Hay una capa sin id.')
    if (ids.has(capa.id)) errores.push(`La capa "${capa.id}" está repetida.`)
    ids.add(capa.id)

    if (!capa.url) errores.push(`La capa "${capa.id}" no tiene url.`)
    if (capa.opacity < 0 || capa.opacity > 1) {
      errores.push(`La capa "${capa.id}" tiene una opacidad fuera de 0 a 1.`)
    }
  }

  if (capasDeTipo(capas, 'base').length === 0) {
    errores.push('No hay ninguna capa base.')
  }

  return errores
}
