'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  addVertex,
  clearDraft,
  closeDraft,
  draftAreaM2,
  draftPerimeterM,
  emptyDraft,
  moveVertex,
  removeVertex,
  undoVertex,
  type Draft,
  type DraftVertex,
} from '@/lib/domain/polygon-draft'
import type { GeoPolygon } from '@/lib/domain/types'

/**
 * Estado del trazado de la parcela.
 *
 * Encapsula el borrador mientras se dibuja y el polígono ya cerrado. La
 * regla de precedencia de la Fase 2 vive acá: mientras hay polígono, el
 * área es la calculada; si no hay polígono, vale el valor escrito a mano.
 */

export type ModoPoligono = 'inactivo' | 'trazando'

export interface UsePoligonoResult {
  modo: ModoPoligono
  draft: Draft
  geometria: GeoPolygon | null
  /** Área del polígono cerrado. `undefined` si no hay polígono. */
  areaGeometria?: number
  perimetroGeometria?: number
  /** Lectura viva mientras se dibuja. */
  areaBorrador: number
  perimetroBorrador: number
  /** Valor escrito a mano. Solo se usa cuando no hay polígono. */
  areaManual: string
  /** Área efectiva: la del polígono si existe, si no la manual. */
  areaEfectiva?: number
  error?: string
  iniciar: () => void
  agregar: (vertice: DraftVertex) => void
  mover: (indice: number, vertice: DraftVertex) => void
  quitar: (indice: number) => void
  deshacer: () => void
  limpiar: () => void
  cancelar: () => void
  terminar: () => boolean
  setAreaManual: (valor: string) => void
  cargar: (geometria: GeoPolygon | null) => void
}

export function usePoligono(): UsePoligonoResult {
  const [modo, setModo] = useState<ModoPoligono>('inactivo')
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [geometria, setGeometria] = useState<GeoPolygon | null>(null)
  const [areaGeometria, setAreaGeometria] = useState<number | undefined>()
  const [perimetroGeometria, setPerimetroGeometria] = useState<number | undefined>()
  const [areaManual, setAreaManualState] = useState('')
  const [error, setError] = useState<string | undefined>()

  const iniciar = useCallback(() => {
    // Empezar un trazado nuevo descarta el polígono anterior, pero no el
    // valor manual: si el usuario lo escribió, se conserva hasta que cierre
    // un polígono que lo reemplace.
    setModo('trazando')
    setDraft(emptyDraft())
    setGeometria(null)
    setAreaGeometria(undefined)
    setPerimetroGeometria(undefined)
    setError(undefined)
  }, [])

  const agregar = useCallback((vertice: DraftVertex) => {
    setDraft((actual) => {
      const resultado = addVertex(actual, vertice)
      setError(resultado.rechazo)
      return resultado.draft
    })
  }, [])

  const mover = useCallback((indice: number, vertice: DraftVertex) => {
    setDraft((actual) => moveVertex(actual, indice, vertice))
  }, [])

  const quitar = useCallback((indice: number) => {
    setDraft((actual) => removeVertex(actual, indice))
  }, [])

  const deshacer = useCallback(() => {
    setDraft((actual) => undoVertex(actual))
    setError(undefined)
  }, [])

  const limpiar = useCallback(() => {
    setDraft(clearDraft())
    setGeometria(null)
    setAreaGeometria(undefined)
    setPerimetroGeometria(undefined)
    setError(undefined)
  }, [])

  const cancelar = useCallback(() => {
    setModo('inactivo')
    setDraft(emptyDraft())
    setError(undefined)
  }, [])

  const terminar = useCallback((): boolean => {
    const resultado = closeDraft(draft)

    if (!resultado.ok) {
      setError(resultado.error)
      return false
    }

    setGeometria(resultado.geometria)
    setAreaGeometria(resultado.areaM2)
    setPerimetroGeometria(resultado.perimetroM)
    setModo('inactivo')
    setDraft(emptyDraft())
    setError(undefined)
    // El polígono reemplaza el valor manual: la regla de S10.
    setAreaManualState('')
    return true
  }, [draft])

  const setAreaManual = useCallback((valor: string) => {
    // Solo se aceptan números o vacío.
    if (valor !== '' && !/^\d*[.,]?\d*$/.test(valor)) return
    setAreaManualState(valor)
    setError(undefined)
  }, [])

  const cargar = useCallback((nueva: GeoPolygon | null) => {
    if (!nueva) {
      setGeometria(null)
      setAreaGeometria(undefined)
      setPerimetroGeometria(undefined)
      return
    }

    const anillo = nueva.coordinates[0] ?? []
    const vertices: DraftVertex[] = anillo.slice(0, -1).map(([lng, lat]) => ({ lng, lat }))

    setGeometria(nueva)
    setAreaGeometria(draftAreaM2(vertices))
    setPerimetroGeometria(draftPerimeterM(vertices))
  }, [])

  const areaBorrador = useMemo(() => draftAreaM2(draft), [draft])
  const perimetroBorrador = useMemo(() => draftPerimeterM(draft), [draft])

  const areaManualNumero = useMemo(() => {
    if (areaManual.trim() === '') return undefined
    const numero = Number(areaManual.replace(',', '.'))
    return Number.isFinite(numero) && numero >= 0 ? numero : undefined
  }, [areaManual])

  const areaEfectiva = geometria ? areaGeometria : areaManualNumero

  return {
    modo,
    draft,
    geometria,
    areaGeometria,
    perimetroGeometria,
    areaBorrador,
    perimetroBorrador,
    areaManual,
    areaEfectiva,
    error,
    iniciar,
    agregar,
    mover,
    quitar,
    deshacer,
    limpiar,
    cancelar,
    terminar,
    setAreaManual,
    cargar,
  }
}
