import { polygonAreaM2, polygonPerimeterM } from './parcela'
import type { GeoPolygon } from './types'

/**
 * Borrador de polígono: el estado de la parcela mientras se dibuja.
 *
 * Es puro. La UI del mapa solo emite "agregaron un vértice en estas
 * coordenadas" y dibuja el resultado; toda la decisión —si el vértice vale,
 * si el polígono ya se puede cerrar, cuánto mide— vive acá.
 *
 * Los vértices están en orden `[longitud, latitud]`, que es el de GeoJSON.
 * Mezclar ese orden es el error clásico de las apps de mapas, así que el
 * tipo lo deja explícito.
 */

export interface DraftVertex {
  lng: number
  lat: number
}

export type Draft = readonly DraftVertex[]

/** Un polígono necesita al menos tres vértices. */
export const MIN_VERTICES = 3

/**
 * Distancia mínima entre vértices, en grados (~1 cm).
 *
 * En móvil el dedo tiembla y llegan varios toques casi en el mismo punto.
 * Sin esta tolerancia se acumulan vértices duplicados que rompen el cálculo
 * de área y hacen que el polígono no se pueda editar.
 */
export const VERTEX_TOLERANCE = 1e-7

export function emptyDraft(): Draft {
  return []
}

function samePoint(a: DraftVertex, b: DraftVertex): boolean {
  return Math.abs(a.lng - b.lng) < VERTEX_TOLERANCE && Math.abs(a.lat - b.lat) < VERTEX_TOLERANCE
}

export interface AddVertexResult {
  draft: Draft
  /** Motivo por el que el vértice no se agregó, si no se agregó. */
  rechazo?: string
}

/** Agrega un vértice al final del borrador. */
export function addVertex(draft: Draft, vertex: DraftVertex): AddVertexResult {
  if (!Number.isFinite(vertex.lng) || !Number.isFinite(vertex.lat)) {
    return { draft, rechazo: 'La posición del vértice no es válida.' }
  }
  if (vertex.lng < -180 || vertex.lng > 180 || vertex.lat < -90 || vertex.lat > 90) {
    return { draft, rechazo: 'El vértice está fuera del mapa.' }
  }

  const ultimo = draft[draft.length - 1]
  if (ultimo && samePoint(ultimo, vertex)) {
    return { draft, rechazo: 'Ya hay un vértice en ese punto.' }
  }

  return { draft: [...draft, { lng: vertex.lng, lat: vertex.lat }] }
}

/** Quita el vértice de una posición. */
export function removeVertex(draft: Draft, index: number): Draft {
  if (index < 0 || index >= draft.length) return draft
  return draft.filter((_, posicion) => posicion !== index)
}

/** Mueve un vértice, por ejemplo al arrastrarlo. */
export function moveVertex(draft: Draft, index: number, vertex: DraftVertex): Draft {
  if (index < 0 || index >= draft.length) return draft
  if (!Number.isFinite(vertex.lng) || !Number.isFinite(vertex.lat)) return draft

  return draft.map((actual, posicion) =>
    posicion === index ? { lng: vertex.lng, lat: vertex.lat } : actual,
  )
}

/** Deshace el último vértice. */
export function undoVertex(draft: Draft): Draft {
  return draft.slice(0, -1)
}

/** Borra el borrador entero. */
export function clearDraft(): Draft {
  return []
}

/**
 * Cierra el anillo para calcular o para exportar.
 *
 * GeoJSON exige que el primer y el último punto coincidan. Si el borrador ya
 * viene cerrado no se duplica.
 */
export function ringFromDraft(draft: Draft): number[][] {
  if (draft.length === 0) return []

  const anillo = draft.map((vertice) => [vertice.lng, vertice.lat])
  const primero = anillo[0]
  const ultimo = anillo[anillo.length - 1]

  if (primero[0] === ultimo[0] && primero[1] === ultimo[1]) return anillo
  return [...anillo, [primero[0], primero[1]]]
}

/** Área en m² del borrador, cerrado implícitamente. Para la lectura viva. */
export function draftAreaM2(draft: Draft): number {
  if (draft.length < MIN_VERTICES) return 0
  return polygonAreaM2([ringFromDraft(draft)])
}

/** Perímetro en m del borrador, cerrado implícitamente. */
export function draftPerimeterM(draft: Draft): number {
  if (draft.length < MIN_VERTICES) return 0
  return polygonPerimeterM([ringFromDraft(draft)])
}

export type CloseDraftResult =
  | { ok: true; geometria: GeoPolygon; areaM2: number; perimetroM: number }
  | { ok: false; error: string }

/**
 * Convierte el borrador en un polígono utilizable.
 *
 * Rechaza lo que no sirve como parcela: menos de tres vértices, área
 * despreciable —vértices alineados— o un anillo que se cruza a sí mismo.
 */
export function closeDraft(draft: Draft): CloseDraftResult {
  if (draft.length < MIN_VERTICES) {
    return {
      ok: false,
      error: `Un polígono necesita al menos ${MIN_VERTICES} vértices (hay ${draft.length}).`,
    }
  }

  // El cruce se chequea antes que el área a propósito: un contorno que se
  // cruza suele dar área cero porque las dos partes se cancelan, y reportarlo
  // como "vértices alineados" manda al usuario a buscar el problema donde no
  // está.
  if (seCruza(draft)) {
    return {
      ok: false,
      error: 'Los lados del polígono se cruzan. Corregí los vértices antes de cerrarlo.',
    }
  }

  const areaM2 = draftAreaM2(draft)
  if (areaM2 < 1) {
    return {
      ok: false,
      error: 'El polígono tiene un área despreciable. Revisá que los vértices no estén alineados.',
    }
  }

  return {
    ok: true,
    geometria: { type: 'Polygon', coordinates: [ringFromDraft(draft)] },
    areaM2,
    perimetroM: draftPerimeterM(draft),
  }
}

/**
 * ¿El contorno se cruza a sí mismo?
 *
 * Se comparan todos los pares de lados que no comparten un vértice. Un
 * polígono que se cruza produce un área sin sentido: la fórmula del
 * trapecio suma las dos partes con signos distintos.
 */
export function seCruza(draft: Draft): boolean {
  const n = draft.length
  if (n < 4) return false

  for (let i = 0; i < n; i += 1) {
    const a1 = draft[i]
    const a2 = draft[(i + 1) % n]

    for (let j = i + 1; j < n; j += 1) {
      // Lados consecutivos comparten un vértice: no cuentan.
      if (j === i || j === (i + 1) % n) continue
      if ((j + 1) % n === i) continue

      const b1 = draft[j]
      const b2 = draft[(j + 1) % n]
      if (segmentosSeCruzan(a1, a2, b1, b2)) return true
    }
  }

  return false
}

function orientacion(a: DraftVertex, b: DraftVertex, c: DraftVertex): number {
  const valor = (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng)
  if (Math.abs(valor) < 1e-14) return 0
  return valor > 0 ? 1 : -1
}

function segmentosSeCruzan(a1: DraftVertex, a2: DraftVertex, b1: DraftVertex, b2: DraftVertex): boolean {
  const o1 = orientacion(a1, a2, b1)
  const o2 = orientacion(a1, a2, b2)
  const o3 = orientacion(b1, b2, a1)
  const o4 = orientacion(b1, b2, a2)

  return o1 !== o2 && o3 !== o4
}
