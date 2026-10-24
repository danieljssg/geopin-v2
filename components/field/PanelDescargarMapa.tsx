'use client'

import { useMemo, useState } from 'react'
import { boundsFromPoints } from '@/lib/map/tiles'
import { estimarArea, formatearBytes, useDescargarMapa } from '@/lib/field/use-descargar-mapa'
import type { DraftVertex } from '@/lib/domain/polygon-draft'

/**
 * Panel de descarga del mapa del área.
 *
 * El área sale del polígono que se está trazando; si no hay ninguno, de un
 * radio alrededor de la posición actual. El botón muestra el volumen
 * estimado antes de descargar, porque son decenas de megabytes y el
 * levantador tiene que saberlo.
 */
export default function PanelDescargarMapa({
  puntos,
  posicionActual,
}: {
  puntos: readonly DraftVertex[]
  posicionActual?: { lat: number; lng: number }
}) {
  const descarga = useDescargarMapa()
  const [abierto, setAbierto] = useState(false)

  const bounds = useMemo(() => {
    if (puntos.length >= 2) {
      return boundsFromPoints(puntos.map((p) => ({ lat: p.lat, lng: p.lng })))
    }
    if (posicionActual) {
      // Un radio de un kilómetro alrededor de la posición actual.
      return boundsFromPoints(
        [
          { lat: posicionActual.lat - 0.009, lng: posicionActual.lng - 0.009 },
          { lat: posicionActual.lat + 0.009, lng: posicionActual.lng + 0.009 },
        ],
        0,
      )
    }
    return null
  }, [puntos, posicionActual])

  const estimacion = useMemo(() => (bounds ? estimarArea(bounds) : null), [bounds])

  if (!bounds || !estimacion) return null

  return (
    <section className="rounded-md p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">
          Mapa sin conexión
        </h3>
        <button
          type="button"
          onClick={() => setAbierto((valor) => !valor)}
          className="text-xs font-semibold underline"
          style={{ color: '#1d4ed8' }}
        >
          {abierto ? 'Ocultar' : 'Descargar'}
        </button>
      </div>

      {abierto && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-600">
            {estimacion.tiles} teselas · unos {formatearBytes(estimacion.bytes)}. Se guardan en
            el dispositivo y el mapa aparece sin señal.
          </p>

          {descarga.descargando && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: '#e2e8f0' }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${descarga.total === 0 ? 0 : (descarga.hechos / descarga.total) * 100}%`,
                    background: '#1d4ed8',
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {descarga.hechos} de {descarga.total} teselas
              </p>
            </div>
          )}

          {descarga.error && (
            <p className="text-xs" style={{ color: '#b91c1c' }}>
              {descarga.error}
            </p>
          )}

          {descarga.resultado && !descarga.descargando && (
            <p className="text-xs" style={{ color: descarga.resultado.fallidos > 0 ? '#92400e' : '#166534' }}>
              {descarga.resultado.descargados} teselas guardadas
              {descarga.resultado.fallidos > 0 && `, ${descarga.resultado.fallidos} no se pudieron bajar`}.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void descarga.descargar(bounds)}
              disabled={descarga.descargando}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: '#1e3a5f' }}
            >
              {descarga.descargando ? 'Descargando…' : 'Descargar el área'}
            </button>

            {descarga.descargando && (
              <button
                type="button"
                onClick={descarga.cancelar}
                className="rounded-md px-3 py-1.5 text-xs font-semibold"
                style={{ background: '#f1f5f9', color: '#334155' }}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
