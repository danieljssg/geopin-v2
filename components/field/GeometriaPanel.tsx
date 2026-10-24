'use client'

import { useState } from 'react'
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
    <section className="rounded-md p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
      <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Geometría de la parcela</h3>

      {/* Polígono cerrado */}
      {hayPoligono && !trazando && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-slate-500">Área</p>
              <p className="font-bold text-slate-900">{formatearMetros(poligono.areaGeometria)} m²</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Perímetro</p>
              <p className="font-bold text-slate-900">{formatearMetros(poligono.perimetroGeometria)} m</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => poligono.iniciar()}
              disabled={deshabilitado}
              className="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              style={{ background: '#dbeafe', color: '#1d4ed8' }}
            >
              Volver a trazar
            </button>
            <button
              type="button"
              onClick={() => poligono.limpiar()}
              disabled={deshabilitado}
              className="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              style={{ background: '#fee2e2', color: '#b91c1c' }}
            >
              Quitar trazado
            </button>
          </div>
        </div>
      )}

      {/* Trazando */}
      {trazando && (
        <div className="mt-2 space-y-2">
          <p className="text-xs text-slate-600">
            {poligono.draft.length === 0
              ? 'Tocá el mapa para marcar el primer vértice.'
              : `${poligono.draft.length} ${poligono.draft.length === 1 ? 'vértice' : 'vértices'}. Tocá para agregar, arrastrá para mover, tocá un vértice para quitarlo.`}
          </p>

          {poligono.draft.length >= 3 && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-slate-500">Área en curso</p>
                <p className="font-bold text-slate-900">{formatearMetros(poligono.areaBorrador)} m²</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Perímetro</p>
                <p className="font-bold text-slate-900">{formatearMetros(poligono.perimetroBorrador)} m</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => poligono.terminar()}
              disabled={poligono.draft.length < 3}
              className="rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              style={{ background: '#15803d' }}
            >
              Cerrar polígono
            </button>
            <button
              type="button"
              onClick={() => poligono.deshacer()}
              disabled={poligono.draft.length === 0}
              className="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
              style={{ background: '#f1f5f9', color: '#334155' }}
            >
              Deshacer
            </button>
            <button
              type="button"
              onClick={() => poligono.cancelar()}
              className="rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{ background: '#f1f5f9', color: '#334155' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Sin polígono ni trazado: m² a mano */}
      {!hayPoligono && !trazando && (
        <div className="mt-2 space-y-2">
          {confirmando ? (
            <div className="rounded-md px-3 py-2 text-xs" style={{ background: '#fef3c7', color: '#92400e' }}>
              <p>Ya escribiste los metros cuadrados a mano. Trazar el polígono los reemplaza.</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={confirmar} className="font-semibold underline">
                  Reemplazar
                </button>
                <button type="button" onClick={() => setConfirmando(false)} className="underline">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="area-manual" className="block text-xs text-slate-500 mb-1">
                  Metros cuadrados (si no trazás el polígono)
                </label>
                <input
                  id="area-manual"
                  type="text"
                  inputMode="decimal"
                  value={poligono.areaManual}
                  onChange={(event) => poligono.setAreaManual(event.target.value)}
                  placeholder="Ej. 120,5"
                  disabled={deshabilitado}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  style={{ borderColor: '#cbd5e1' }}
                />
              </div>

              <button
                type="button"
                onClick={onTrazar}
                disabled={deshabilitado}
                className="rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                style={{ background: '#1e3a5f', color: '#ffffff' }}
              >
                Trazar en el mapa
              </button>
            </>
          )}
        </div>
      )}

      {poligono.error && (
        <p role="alert" className="mt-2 rounded-md px-2 py-1.5 text-xs" style={{ background: '#fee2e2', color: '#b91c1c' }}>
          {poligono.error}
        </p>
      )}
    </section>
  )
}

function formatearMetros(valor: number | undefined): string {
  if (valor === undefined || Number.isNaN(valor)) return '—'
  return valor.toLocaleString('es-VE', { maximumFractionDigits: 2 })
}
