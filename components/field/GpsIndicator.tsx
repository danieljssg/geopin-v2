'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatAccuracy, fixMessage, qualityOf, type GpsFix } from '@/lib/domain/gps'
import { cn } from '@/lib/utils'

/**
 * Indicador del estado del GPS.
 *
 * El plan pide que muestre la precisión en metros y el estado de la
 * fijación. En la variante compacta va en la cabecera; en la variante de
 * panel explica qué hacer cuando la lectura no alcanza.
 */

const VARIANTE: Record<GpsFix, 'secondary' | 'outline' | 'destructive' | 'ghost'> = {
  fijado: 'secondary',
  impreciso: 'outline',
  buscando: 'outline',
  'sin-permiso': 'destructive',
  error: 'destructive',
  'sin-soporte': 'ghost',
}

export interface GpsIndicatorProps {
  fix: GpsFix
  accuracy: number | undefined | null
  /** `pill` para la cabecera, `panel` para el formulario. */
  variant?: 'pill' | 'panel'
  onReintentar?: () => void
}

export default function GpsIndicator({
  fix,
  accuracy,
  variant = 'pill',
  onReintentar,
}: GpsIndicatorProps) {
  const calidad = qualityOf(accuracy)

  if (variant === 'pill') {
    return (
      <Badge variant={VARIANTE[fix]} role="status" aria-live="polite">
        <span
          aria-hidden="true"
          className={cn('size-[7px] rounded-full bg-current', fix === 'buscando' && 'opacity-50')}
        />
        {fix === 'fijado' && `GPS ${formatAccuracy(accuracy)}`}
        {fix === 'impreciso' && `GPS ${formatAccuracy(accuracy)} — débil`}
        {fix === 'buscando' && 'Buscando GPS…'}
        {fix === 'sin-permiso' && 'GPS denegado'}
        {fix === 'sin-soporte' && 'Sin GPS'}
        {fix === 'error' && 'GPS sin señal'}
      </Badge>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-lg border border-border bg-card px-3 py-2 text-xs text-card-foreground',
        (fix === 'sin-permiso' || fix === 'error') && 'text-destructive',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {fix === 'fijado' && `Precisión ${formatAccuracy(accuracy)}`}
            {fix === 'impreciso' && `Precisión ${formatAccuracy(accuracy)} — no alcanza`}
            {fix === 'buscando' && 'Buscando señal GPS…'}
            {fix === 'sin-permiso' && 'Ubicación denegada'}
            {fix === 'sin-soporte' && 'Este dispositivo no tiene GPS'}
            {fix === 'error' && 'El GPS no pudo ubicarte'}
          </p>
          <p className="mt-0.5 opacity-80">{fixMessage(fix)}</p>
        </div>

        {(fix === 'sin-permiso' || fix === 'error' || fix === 'sin-soporte') && onReintentar && (
          <Button
            type="button"
            variant="link"
            size="xs"
            className="shrink-0"
            onClick={onReintentar}
          >
            Reintentar
          </Button>
        )}
      </div>

      {calidad === 'imprecisa' && (
        <p className="mt-1 opacity-80">
          Podés esperar a que mejore o tocar el mapa para ubicar el pin a mano.
        </p>
      )}
    </div>
  )
}
