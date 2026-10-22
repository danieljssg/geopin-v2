/**
 * Disparadores de sincronización del cliente de campo.
 *
 * La cola tiene que drenarse sola: el levantador no puede estar apretando
 * "sincronizar" después de cada parcela. Estos son los momentos en que se
 * intenta:
 *
 * 1. **La red vuelve.** El evento `online` del navegador. Es el caso
 *    principal: el surveyor sale de cobertura y la app se entera sola.
 * 2. **La app vuelve al frente.** `visibilitychange`. En iOS, que es donde
 *    no hay Background Sync, este es el disparador de fondo real.
 * 3. **Cada certainos segundos**, mientras la app está abierta.
 * 4. **A mano**, desde el botón de la interfaz.
 *
 * En Chromium hay además Background Sync, que permite al service worker
 * retomar el envío aunque la app esté cerrada. Se pide de forma opcional:
 * en iOS no existe la API y no debe romper nada.
 */

export interface SyncTriggerOptions {
  runSync: () => Promise<unknown>
  /** Cada cuánto se intenta el drenado. Por defecto, 60 s. */
  intervalMs?: number
  /** Nombre de la etiqueta de Background Sync. */
  syncTag?: string
}

export interface SyncTriggerHandle {
  /** Desregistra todo. */
  stop: () => void
  /** Pide al navegador que reintente en segundo plano, si puede. */
  requestBackgroundSync: () => Promise<boolean>
}

/** La interfaz de Background Sync que expone el navegador. */
interface SyncManager {
  register(tag: string): Promise<void>
}

function getSyncManager(): SyncManager | undefined {
  if (typeof navigator === 'undefined') return undefined
  return (navigator as Navigator & { sync?: SyncManager }).sync
}

/** ¿El navegador soporta Background Sync? */
export function supportsBackgroundSync(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof getSyncManager()?.register === 'function'
  )
}

/**
 * Registra los disparadores y devuelve la función para desregistrarlos.
 *
 * Devolver el cleanup importa: en desarrollo, con el hot reload de Next.js,
 * un listener sin limpiar termina registering el mismo handler varias veces
 * y cada sincronización se dispara N veces.
 */
export function registerSyncTriggers(options: SyncTriggerOptions): SyncTriggerHandle {
  const intervalMs = options.intervalMs ?? 60_000
  const syncTag = options.syncTag ?? 'geopin-sync'

  const alVolverLaRed = () => {
    void options.runSync()
  }

  const alVolverAlFrente = () => {
    if (document.visibilityState === 'visible') void options.runSync()
  }

  window.addEventListener('online', alVolverLaRed)
  document.addEventListener('visibilitychange', alVolverAlFrente)

  const intervalo = window.setInterval(() => {
    void options.runSync()
  }, intervalMs)

  const requestBackgroundSync = async (): Promise<boolean> => {
    if (!supportsBackgroundSync()) return false
    try {
      const registro = await navigator.serviceWorker.ready
      const sync = (registro as ServiceWorkerRegistration & { sync?: SyncManager }).sync
      if (!sync) return false
      await sync.register(syncTag)
      return true
    } catch {
      return false
    }
  }

  return {
    stop: () => {
      window.removeEventListener('online', alVolverLaRed)
      document.removeEventListener('visibilitychange', alVolverAlFrente)
      window.clearInterval(intervalo)
    },
    requestBackgroundSync,
  }
}
