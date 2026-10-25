'use client'

import { useMemo, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { boundsFromPoints } from '@/lib/map/tiles'
import { estimarArea, formatearBytes, useDescargarMapa } from '@/lib/field/use-descargar-mapa'
import { hasOwnTileSource } from '@/lib/map/tile-sources'
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

  /**
   * Sin fuente propia no hay nada que descargar: los tiles salen del blob
   * del levantamiento. El botón se desactiva en vez de bajar cientos de
   * teselas que el servidor va a responder con 404.
   */
  const fuentePropia = hasOwnTileSource()

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
    <section className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
          Mapa sin conexión
        </h3>
        <Button type="button" variant="ghost" size="xs" onClick={() => setAbierto((valor) => !valor)}>
          {abierto ? 'Ocultar' : 'Descargar'}
        </Button>
      </div>

      {abierto && (
        <div className="mt-2 space-y-2">
          {!fuentePropia ? (
            <Alert>
              <AlertDescription>
                No hay mapa propio configurado. Hacen falta los tiles renderizados en el blob
                (<code>BLOB_SAS_URL</code>) y la ruta pública de la fuente
                (<code>NEXT_PUBLIC_TILE_BASE_URL</code>).
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-xs text-muted-foreground">
              {estimacion.tiles} teselas · unos {formatearBytes(estimacion.bytes)}. Se guardan en
              el dispositivo y el mapa aparece sin señal.
            </p>
          )}

          {descarga.descargando && (
            <div>
              <Progress
                value={descarga.total === 0 ? 0 : (descarga.hechos / descarga.total) * 100}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {descarga.hechos} de {descarga.total} teselas
              </p>
            </div>
          )}

          {descarga.error && (
            <Alert variant="destructive">
              <AlertDescription>{descarga.error}</AlertDescription>
            </Alert>
          )}

          {descarga.resultado && !descarga.descargando && (
            <Alert>
              <AlertDescription>
                {descarga.resultado.descargados} teselas guardadas
                {descarga.resultado.fallidos > 0 &&
                  `, ${descarga.resultado.fallidos} no se pudieron bajar`}
                .
              </AlertDescription>
            </Alert>
          )}

          {/* Si no bajó ninguna, la causa importa más que el conteo. */}
          {descarga.resultado &&
            !descarga.descargando &&
            descarga.resultado.descargados === 0 &&
            descarga.resultado.errores.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  {descarga.resultado.errores[0].mensaje}
                </AlertDescription>
              </Alert>
            )}

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void descarga.descargar(bounds)}
              disabled={descarga.descargando || !fuentePropia}
            >
              {descarga.descargando ? 'Descargando…' : 'Descargar el área'}
            </Button>

            {descarga.descargando && (
              <Button type="button" variant="outline" size="sm" onClick={descarga.cancelar}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
