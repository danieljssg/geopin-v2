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
import { countBlocked, countPending, enqueueParcela, getConflictedEntries, releaseBlockedEntries } from '@/lib/field/outbox'
import { runSync } from '@/lib/field/sync'
import { registerSyncTriggers } from '@/lib/field/triggers'
import { getCampoDB } from '@/lib/field/db'
import { useSession } from '@/lib/auth-client'

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
  bloqueadas: number
  sincronizando: boolean
  ultimoError?: string
  ultimaSincronizacion?: string
  sincronizar: () => Promise<void>
  reintentarBloqueadas: () => Promise<void>
  encolar: (payload: ParcelaCreateRequest) => Promise<void>
}

/** Lee los contadores de la cola. Fuera del componente a propósito. */
async function leerContadores(db = getCampoDB()): Promise<{ pendientes: number; conflictos: number; bloqueadas: number }> {
  const [pendientes, conflictos, bloqueadas] = await Promise.all([
    countPending({ db }),
    getConflictedEntries({ db }).then((entradas) => entradas.length),
    countBlocked({ db }),
  ])
  return { pendientes, conflictos, bloqueadas }
}

const SyncContext = createContext<SyncState | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  const userId = session.data?.user?.id
  const db = useMemo(() => getCampoDB(userId ?? 'anonymous'), [userId])
  const [pendientes, setPendientes] = useState(0)
  const [conflictos, setConflictos] = useState(0)
  const [bloqueadas, setBloqueadas] = useState(0)
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimoError, setUltimoError] = useState<string | undefined>()
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string | undefined>()
  const enCurso = useRef(false)

  const refrescar = useCallback(async () => {
    const [pendientesActuales, conflictosActuales, bloqueadasActuales] = await Promise.all([
      countPending({ db }),
      getConflictedEntries({ db }).then((entradas) => entradas.length),
      countBlocked({ db }),
    ])
    setPendientes(pendientesActuales)
    setConflictos(conflictosActuales)
    setBloqueadas(bloqueadasActuales)
  }, [db])

  const sincronizar = useCallback(async () => {
    if (enCurso.current) return
    enCurso.current = true
    setSincronizando(true)

    try {
      if (!userId) return
      const resumen = await runSync({ db, actorId: userId })
      setUltimoError(resumen.error)
      if (!resumen.omitida) setUltimaSincronizacion(new Date().toISOString())
    } catch (error) {
      setUltimoError(error instanceof Error ? error.message : 'Error desconocido.')
    } finally {
      enCurso.current = false
      setSincronizando(false)
      if (userId) await refrescar()
    }
  }, [db, refrescar, userId])

  const reintentarBloqueadas = useCallback(async () => {
    if (!userId) return
    await releaseBlockedEntries({ db })
    await refrescar()
    await sincronizar()
  }, [db, refrescar, sincronizar, userId])

  const encolar = useCallback(
    async (payload: ParcelaCreateRequest) => {
      if (!userId) throw new Error('Inicia sesión para guardar datos en la cola de sincronización.')
      await enqueueParcela(payload, { db })
      await refrescar()
      // No se espera al sincronizador: encolar no tiene por qué bloquear la
      // captura. El drenado ocurre por los disparadores.
      void sincronizar()
    },
    [db, refrescar, sincronizar, userId],
  )

  /**
   * Los contadores se aplican en un `.then()`: un setState síncrono dentro
   * del efecto provoca un render en cascada.
   */
  useEffect(() => {
    let vivo = true

    if (!userId) return
    void leerContadores(db).then(({ pendientes: p, conflictos: c, bloqueadas: b }) => {
      if (!vivo) return
      setPendientes(p)
      setConflictos(c)
      setBloqueadas(b)
    })

    const handle = registerSyncTriggers({ runSync: sincronizar })

    return () => {
      vivo = false
      handle.stop()
    }
  }, [db, sincronizar, userId])

  const valor = useMemo<SyncState>(
    () => ({
      pendientes,
      conflictos,
      bloqueadas,
      sincronizando,
      ultimoError,
      ultimaSincronizacion,
      sincronizar,
      reintentarBloqueadas,
      encolar,
    }),
    [pendientes, conflictos, bloqueadas, sincronizando, ultimoError, ultimaSincronizacion, sincronizar, reintentarBloqueadas, encolar],
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
