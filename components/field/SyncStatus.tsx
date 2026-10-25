'use client'

import { Loader2Icon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

  const variante = conflictos > 0 ? 'destructive' : pendientes > 0 ? 'secondary' : 'outline'
  // Un error de sync sin conteos no tiene nada que mostrar en el badge; el
  // botón de sincronizar sigue siendo la acción disponible.
  const hayDetalle = sincronizando || conflictos > 0 || pendientes > 0

  return (
    <div
      className="flex items-center gap-2 text-xs font-medium"
      role="status"
      aria-live="polite"
    >
      {hayDetalle && (
        <Badge variant={variante}>
          {sincronizando && <Loader2Icon className="animate-spin" aria-hidden="true" />}

          {conflictos > 0 && <span>{conflictos} en conflicto</span>}
          {conflictos > 0 && pendientes > 0 && <span aria-hidden="true">·</span>}
          {pendientes > 0 && (
            <span>
              {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'}
            </span>
          )}
          {sincronizando && pendientes === 0 && conflictos === 0 && <span>Sincronizando…</span>}
        </Badge>
      )}

      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => void sincronizar()}
        disabled={sincronizando}
      >
        Sincronizar
      </Button>
    </div>
  )
}
