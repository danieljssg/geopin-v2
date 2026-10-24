'use client'

import { formatAccuracy, fixMessage, qualityOf, type GpsFix } from '@/lib/domain/gps'

/**
 * Indicador del estado del GPS.
 *
 * El plan pide que muestre la precisión en metros y el estado de la
 * fijación. En la variante compacta va en la cabecera; en la variante de
 * panel explica qué hacer cuando la lectura no alcanza.
 */

const COLORES: Record<GpsFix, { texto: string; fondo: string }> = {
  fijado: { texto: '#166534', fondo: '#dcfce7' },
  impreciso: { texto: '#92400e', fondo: '#fef3c7' },
  buscando: { texto: '#1e40af', fondo: '#dbeafe' },
  'sin-permiso': { texto: '#b91c1c', fondo: '#fee2e2' },
  error: { texto: '#b91c1c', fondo: '#fee2e2' },
  'sin-soporte': { texto: '#475569', fondo: '#e2e8f0' },
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
  const colores = COLORES[fix]
  const calidad = qualityOf(accuracy)

  if (variant === 'pill') {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
        style={{ background: colores.fondo, color: colores.texto }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'currentColor',
            display: 'inline-block',
            opacity: fix === 'buscando' ? 0.5 : 1,
          }}
        />
        {fix === 'fijado' && `GPS ${formatAccuracy(accuracy)}`}
        {fix === 'impreciso' && `GPS ${formatAccuracy(accuracy)} — débil`}
        {fix === 'buscando' && 'Buscando GPS…'}
        {fix === 'sin-permiso' && 'GPS denegado'}
        {fix === 'sin-soporte' && 'Sin GPS'}
        {fix === 'error' && 'GPS sin señal'}
      </span>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-md px-3 py-2 text-xs"
      style={{ background: colores.fondo, color: colores.texto }}
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
          <button type="button" onClick={onReintentar} className="shrink-0 font-semibold underline">
            Reintentar
          </button>
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
