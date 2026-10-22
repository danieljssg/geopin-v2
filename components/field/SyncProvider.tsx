'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import { countPending, enqueueParcela, getConflictedEntries } from '@/lib/field/outbox'
import { runSync } from '@/lib/field/sync'
import { registerSyncTriggers } from '@/lib/field/triggers'

/**
 * Proveedor de sincronización del cliente de campo.
 *
 * Monta los disparadores una sola vez y expone el estado de la cola para que
 * la interfaz muestre cuántas Parcelas quedan por subir y cuáles quedaron en
 * conflicto.
 *
 * `runSync` tiene un guardia propio: dos disparos seguidos —el `online` y el
 * `visibilitychange`, por ejemplo— no pueden mandar la misma tanda dos veces.
 */

export interface SyncState {
  pendientes: number
  conflictos: number
  sincronizando: boolean
  ultimoError?: string
  ultimaSincronizacion?: string
  sincronizar: () => Promise<void>
  encolar: (payload: ParcelaCreateRequest) => Promise<void>
}

const SyncContext = createContext<SyncState | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const [pendientes, setPendientes] = useState(0)
  const [conflictos, setConflictos] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimoError, setUltimoError] = useState<string | undefined>()
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string | undefined>()
  const enCurso = useRef(false)

  const refrescar = useCallback(async () => {
    const [pendientesActuales, conflictosActuales] = await Promise.all([
      countPending(),
      getConflictedEntries().then((entradas) => entradas.length),
    ])
    setPendientes(pendientesActuales)
    setConflictos(conflictosActuales)
  }, [])

  const sincronizar = useCallback(async () => {
    if (enCurso.current) return
    enCurso.current = true
    setSincronizando(true)

    try {
      const resumen = await runSync()
      setUltimoError(resumen.error)
      if (!resumen.omitida) setUltimaSincronizacion(new Date().toISOString())
    } catch (error) {
      setUltimoError(error instanceof Error ? error.message : 'Error desconocido.')
    } finally {
      enCurso.current = false
      setSincronizando(false)
      await refrescar()
    }
  }, [refrescar])

  const encolar = useCallback(
    async (payload: ParcelaCreateRequest) => {
      await enqueueParcela(payload)
      await refrescar()
      // No se espera al sincronizador: encolar no tiene por qué bloquear la
      // captura. El drenado ocurre por los disparadores.
      void sincronizar()
    },
    [refrescar, sincronizar],
  )

  useEffect(() => {
    void refrescar()
    const handle = registerSyncTriggers({ runSync: sincronizar })
    return () => handle.stop()
  }, [refrescar, sincronizar])

  const valor = useMemo<SyncState>(
    () => ({
      pendientes,
      conflictos,
      sincronizando,
      ultimoError,
      ultimaSincronizacion,
      sincronizar,
      encolar,
    }),
    [pendientes, conflictos, sincronizando, ultimoError, ultimaSincronizacion, sincronizar, encolar],
  )

  return <SyncContext.Provider value={valor}>{children}</SyncContext.Provider>
}

/** Estado de la sincronización. Lanza si se usa fuera del proveedor. */
export function useSync(): SyncState {
  const contexto = useContext(SyncContext)
  if (!contexto) {
    throw new Error('useSync se tiene que usar dentro de un SyncProvider.')
  }
  return contexto
}
