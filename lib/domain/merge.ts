import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import type { Parcela, ParcelaModuloData } from './types'

/**
 * Fusión de dos registros de la misma parcela.
 *
 * Cuando un archivo de campo y la base tienen el mismo inmueble, no gana
 * ninguno de los dos: gana el campo por campo, según lo que elija el
 * administrador. El valor que no se elige se conserva.
 */

export type LadoFusion = 'existente' | 'entrante'

export interface CampoEnConflicto {
  /** Nombre canónico del campo: del núcleo o `modulo.clave`. */
  campo: string
  valorExistente: unknown
  valorEntrante: unknown
}

export interface PropuestaMerge {
  parcelaId: string
  /** Solo los campos que difieren. */
  conflictos: CampoEnConflicto[]
  /** Propuesta inicial: se conserva lo que ya está en la base. */
  eleccionInicial: Record<string, LadoFusion>
}

/** Campos del núcleo que se comparan en una fusión. */
const CAMPOS_NUCLEO = [
  'nombre',
  'descripcion',
  'categoria',
  'codigo',
  'area_m2',
  'perimetro_m',
] as const

function iguales(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) return false
  if (typeof a === 'number' && typeof b === 'number') return a === b
  if (typeof a === 'string' && typeof b === 'string') return a.trim() === b.trim()
  if (typeof a !== typeof b) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

function valorNucleo(parcela: Parcela, campo: string): unknown {
  switch (campo) {
    case 'area_m2':
      return parcela.areaM2 ?? null
    case 'perimetro_m':
      return parcela.perimetroM ?? null
    case 'codigo':
      return parcela.codigo ?? null
    default:
      return (parcela as unknown as Record<string, unknown>)[campo] ?? null
  }
}

function valorEntrante(entrante: ParcelaCreateRequest, campo: string): unknown {
  switch (campo) {
    case 'area_m2':
      return entrante.areaM2 ?? null
    case 'perimetro_m':
      return entrante.perimetroM ?? null
    case 'codigo':
      return entrante.codigo ?? null
    default:
      return (entrante as unknown as Record<string, unknown>)[campo] ?? null
  }
}

/**
 * Propone la fusión de una parcela guardada con una fila importada.
 *
 * Solo devuelve los campos que **difieren**. Los que coinciden no son
 * conflictos y no se le preguntan al usuario.
 */
export function proponerMerge(
  existente: Parcela,
  entrante: ParcelaCreateRequest,
): PropuestaMerge {
  const conflictos: CampoEnConflicto[] = []
  const eleccionInicial: Record<string, LadoFusion> = {}

  for (const campo of CAMPOS_NUCLEO) {
    const guardado = valorNucleo(existente, campo)
    const nuevo = valorEntrante(entrante, campo)

    if (iguales(guardado, nuevo)) continue

    conflictos.push({ campo, valorExistente: guardado, valorEntrante: nuevo })
    eleccionInicial[campo] = 'existente'
  }

  // Ubicación: se compara como par de coordenadas.
  const ubicacionExistente = existente.ubicacion.coordinates
  const ubicacionEntrante: [number, number] = [entrante.ubicacion.lng, entrante.ubicacion.lat]

  if (!iguales(ubicacionExistente[0], ubicacionEntrante[0]) || !iguales(ubicacionExistente[1], ubicacionEntrante[1])) {
    conflictos.push({
      campo: 'ubicacion',
      valorExistente: { lat: ubicacionExistente[1], lng: ubicacionExistente[0] },
      valorEntrante: { lat: ubicacionEntrante[1], lng: ubicacionEntrante[0] },
    })
    eleccionInicial.ubicacion = 'existente'
  }

  // Módulos: campo por campo dentro de cada módulo.
  const modulosEntrantes = new Map<string, Record<string, unknown>>()
  for (const modulo of entrante.modulos ?? []) {
    modulosEntrantes.set(modulo.moduleId, modulo.datos)
  }

  for (const [moduleId, datosEntrantes] of modulosEntrantes) {
    const moduloExistente = existente.modulos?.[moduleId]

    for (const [clave, valorEntrante] of Object.entries(datosEntrantes)) {
      const guardado = moduloExistente?.datos?.[clave] ?? null

      if (iguales(guardado, valorEntrante)) continue

      conflictos.push({
        campo: `${moduleId}.${clave}`,
        valorExistente: guardado,
        valorEntrante,
      })
      eleccionInicial[`${moduleId}.${clave}`] = 'existente'
    }
  }

  return { parcelaId: existente.id, conflictos, eleccionInicial }
}

/**
 * Aplica un conjunto de cambios a una parcela.
 *
 * Es la operacion atomica del modulo: el mapa es el valor **final** de cada
 * campo, y lo que no aparece se conserva tal como estaba. Los modulos cuyo
 * valor no cambia no se tocan, para no subir la version de algo que no se
 * modifico.
 */
export function aplicarCambios(
  existente: Parcela,
  cambios: Record<string, unknown>,
  ahora: string,
  actor: string,
): Parcela {
  const modulos: Record<string, ParcelaModuloData> = { ...existente.modulos }
  const nucleo: Parcela = { ...existente, modulos }

  for (const [campo, valor] of Object.entries(cambios)) {
    if (!campo.includes('.')) {
      switch (campo) {
        case 'nombre':
          nucleo.nombre = String(valor ?? '')
          break
        case 'descripcion':
          nucleo.descripcion = String(valor ?? '')
          break
        case 'categoria':
          nucleo.categoria = String(valor ?? '')
          break
        case 'codigo':
          nucleo.codigo = (valor as string | undefined) ?? undefined
          break
        case 'area_m2':
          nucleo.areaM2 = (valor as number | undefined) ?? undefined
          break
        case 'perimetro_m':
          nucleo.perimetroM = (valor as number | undefined) ?? undefined
          break
        case 'ubicacion': {
          const punto = valor as { lat: number; lng: number }
          nucleo.ubicacion = { type: 'Point', coordinates: [punto.lng, punto.lat] }
          break
        }
        default:
          break
      }
      continue
    }

    const [moduleId, clave] = campo.split('.')
    const actual = modulos[moduleId] ?? {
      version: 0,
      schemaVersion: 1,
      datos: {},
      actualizadoEn: ahora,
      actualizadoPor: actor,
    }

    modulos[moduleId] = {
      ...actual,
      version: actual.version + 1,
      datos: { ...actual.datos, [clave]: valor },
      actualizadoEn: ahora,
      actualizadoPor: actor,
    }
  }

  nucleo.version = existente.version + 1
  nucleo.actualizadoEn = ahora
  nucleo.actualizadoPor = actor

  return nucleo
}

/**
 * Aplica la fusion con las elecciones del administrador.
 *
 * Lo que no se eligio se conserva.
 */
export function aplicarMerge(
  existente: Parcela,
  entrante: ParcelaCreateRequest,
  elecciones: Record<string, LadoFusion>,
  ahora: string,
  actor: string,
): Parcela {
  const cambios: Record<string, unknown> = {}

  for (const [campo, lado] of Object.entries(elecciones)) {
    if (lado !== 'entrante') continue

    if (campo.includes('.')) {
      const [moduleId, clave] = campo.split('.')
      const valor = (entrante.modulos ?? []).find((m) => m.moduleId === moduleId)?.datos?.[clave]
      if (valor !== undefined) cambios[campo] = valor
      continue
    }

    if (campo === 'ubicacion') {
      cambios[campo] = { lat: entrante.ubicacion.lat, lng: entrante.ubicacion.lng }
      continue
    }

    const valor = valorEntrante(entrante, campo)
    if (valor !== null && valor !== undefined) cambios[campo] = valor
  }

  return aplicarCambios(existente, cambios, ahora, actor)
}
