'use client'

import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { UsePoligonoResult } from '@/lib/field/use-poligono'

/**
 * Panel de geometría de la parcela.
 *
 * Tiene los dos caminos que pide la Fase 2: trazar el polígono sobre el mapa
 * —con área y perímetro calculados— o escribir los metros cuadrados a mano
 * cuando no hay trazado.
 *
 * Regla de precedencia: mientras haya polígono, el área es la calculada y el
 * campo manual desaparece. Si el levantador ya había escrito un valor, se le
 * avisa antes de que el trazado lo reemplace.
 */

export default function GeometriaPanel({
  poligono,
  deshabilitado = false,
}: {
  poligono: UsePoligonoResult
  deshabilitado?: boolean
}) {
  const [confirmando, setConfirmando] = useState(false)

  const trazando = poligono.modo === 'trazando'
  const hayPoligono = poligono.geometria !== null
  const hayManual = poligono.areaManual.trim() !== ''

  function onTrazar() {
    if (hayManual && !hayPoligono) {
      setConfirmando(true)
      return
    }
    poligono.iniciar()
  }

  function confirmar() {
    setConfirmando(false)
    poligono.setAreaManual('')
    poligono.iniciar()
  }

  return (
    <section className="rounded-lg border border-border bg-card p-3">
      <h3 className="text-xs font-bold tracking-wide uppercase text-muted-foreground">
        Geometría de la parcela
      </h3>

      {/* Polígono cerrado */}
      {hayPoligono && !trazando && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Área</p>
              <p className="font-bold text-foreground">{formatearMetros(poligono.areaGeometria)} m²</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Perímetro</p>
              <p className="font-bold text-foreground">{formatearMetros(poligono.perimetroGeometria)} m</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => poligono.iniciar()}
              disabled={deshabilitado}
            >
              Volver a trazar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => poligono.limpiar()}
              disabled={deshabilitado}
            >
              Quitar trazado
            </Button>
          </div>
        </div>
      )}

      {/* Trazando */}
      {trazando && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">
            {poligono.draft.length === 0
              ? 'Tocá el mapa para marcar el primer vértice.'
              : `${poligono.draft.length} ${poligono.draft.length === 1 ? 'vértice' : 'vértices'}. Tocá para agregar, arrastrá para mover, tocá un vértice para quitarlo.`}
          </p>

          {poligono.draft.length >= 3 && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Área en curso</p>
                <p className="font-bold text-foreground">{formatearMetros(poligono.areaBorrador)} m²</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Perímetro</p>
                <p className="font-bold text-foreground">{formatearMetros(poligono.perimetroBorrador)} m</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => poligono.terminar()}
              disabled={poligono.draft.length < 3}
            >
              Cerrar polígono
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => poligono.deshacer()}
              disabled={poligono.draft.length === 0}
            >
              Deshacer
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => poligono.cancelar()}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Sin polígono ni trazado: m² a mano */}
      {!hayPoligono && !trazando && (
        <div className="mt-2 space-y-2">
          {confirmando ? (
            <Alert>
              <AlertDescription>
                Ya escribiste los metros cuadrados a mano. Trazar el polígono los reemplaza.
                <div className="mt-2 flex gap-2">
                  <Button type="button" size="xs" onClick={confirmar}>
                    Reemplazar
                  </Button>
                  <Button type="button" size="xs" variant="ghost" onClick={() => setConfirmando(false)}>
                    Cancelar
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div>
                <Label htmlFor="area-manual" className="mb-1">
                  Metros cuadrados (si no trazás el polígono)
                </Label>
                <Input
                  id="area-manual"
                  type="text"
                  inputMode="decimal"
                  value={poligono.areaManual}
                  onChange={(event) => poligono.setAreaManual(event.target.value)}
                  placeholder="Ej. 120,5"
                  disabled={deshabilitado}
                />
              </div>

              <Button type="button" size="sm" onClick={onTrazar} disabled={deshabilitado}>
                Trazar en el mapa
              </Button>
            </>
          )}
        </div>
      )}

      {poligono.error && (
        <Alert variant="destructive" className="mt-2">
          <AlertDescription>{poligono.error}</AlertDescription>
        </Alert>
      )}
    </section>
  )
}

function formatearMetros(valor: number | undefined): string {
  if (valor === undefined || Number.isNaN(valor)) return '—'
  return valor.toLocaleString('es-VE', { maximumFractionDigits: 2 })
}
