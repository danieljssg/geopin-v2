'use client'

import { useSync } from './SyncProvider'

/**
 * Indicador del estado de la sincronización.
 *
 * En campo es la única señal de que el trabajo está a salvo. Si hay
 * parcelas pendientes o en conflicto, el levantador tiene que verlo sin
 * tener que abrir un menú.
 */
export default function SyncStatus() {
  const { pendientes, conflictos, sincronizando, ultimoError, sincronizar } = useSync()

  if (pendientes === 0 && conflictos === 0 && !sincronizando && !ultimoError) {
    return null
  }

  const tono = conflictos > 0 ? '#b91c1c' : pendientes > 0 ? '#a16207' : '#166534'

  return (
    <div
      className="flex items-center gap-2 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: `${tono}18`, color: tono }}
      role="status"
      aria-live="polite"
    >
      {sincronizando && (
        <span
          aria-hidden="true"
          style={{
            width: 9,
            height: 9,
            border: '1.5px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      )}

      {conflictos > 0 && <span>{conflictos} en conflicto</span>}
      {conflictos > 0 && pendientes > 0 && <span aria-hidden="true">·</span>}
      {pendientes > 0 && (
        <span>
          {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'}
        </span>
      )}
      {sincronizando && pendientes === 0 && conflictos === 0 && <span>Sincronizando…</span>}

      <button
        type="button"
        onClick={() => void sincronizar()}
        disabled={sincronizando}
        style={{ textDecoration: 'underline', marginLeft: 2 }}
      >
        Sincronizar
      </button>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
