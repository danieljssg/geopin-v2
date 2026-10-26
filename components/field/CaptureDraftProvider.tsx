'use client'

import { createContext, useContext, useMemo, useState, useCallback, type ReactNode } from 'react'
import type { Parcela } from '@/lib/domain/types'

type Draft = { nombre: string; categoria: string; descripcion: string; valores: Record<string, Record<string, unknown>>; moduloActivo: string }
type State = { draft: Draft; setDraft: (draft: Draft) => void; reset: (initial?: Parcela | null) => void }
const Context = createContext<State | null>(null)
const empty: Draft = { nombre: '', categoria: 'Vivienda', descripcion: '', valores: {}, moduloActivo: '' }

export function CaptureDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState(empty)
  const reset = useCallback((initial?: Parcela | null) => setDraft(initial ? { nombre: initial.nombre, categoria: initial.categoria, descripcion: initial.descripcion ?? '', valores: Object.fromEntries(Object.entries(initial.modulos ?? {}).map(([id, m]) => [id, m.datos])), moduloActivo: '' } : empty), [])
  const value = useMemo(() => ({ draft, setDraft, reset }), [draft, reset])
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useCaptureDraft() { const value = useContext(Context); if (!value) throw new Error('CaptureDraftProvider requerido'); return value }
