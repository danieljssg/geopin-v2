'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { capasDeTipo, type CapaMapa } from '@/lib/map/capas'

/**
 * Panel de capas del mapa.
 *
 * Las bases se eligen de a una y las superposiciones se apilan con su
 * opacidad: una ortofoto al 80% deja ver los nombres de las calles debajo,
 * que es justo para lo que sirve.
 */
export default function PanelCapas({
  capas,
  baseActiva,
  onCambiarBase,
  overlaysVisibles,
  onToggleOverlay,
  opacidades,
  onCambiarOpacidad,
}: {
  capas: CapaMapa[]
  baseActiva: string
  onCambiarBase: (id: string) => void
  overlaysVisibles: string[]
  onToggleOverlay: (id: string) => void
  opacidades: Record<string, number>
  onCambiarOpacidad: (id: string, valor: number) => void
}) {
  const [abierto, setAbierto] = useState(false)

  const bases = capasDeTipo(capas, 'base')
  const superpuestas = capasDeTipo(capas, 'superposicion')

  if (bases.length === 0 && superpuestas.length === 0) return null

  return (
    <div className="absolute bottom-7 left-3 z-[1000] max-w-[260px] min-w-[200px] overflow-hidden rounded-lg border border-border bg-card text-xs text-card-foreground shadow-lg">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        className="flex w-full items-center justify-between gap-3 bg-muted px-3 py-2 text-left font-semibold text-foreground"
      >
        <span>Capas</span>
        <span aria-hidden="true">{abierto ? '▾' : '▸'}</span>
      </button>

      {abierto && (
        <div className="max-h-[45vh] space-y-3 overflow-y-auto p-3">
          <section>
            <h3 className="mb-1.5 font-semibold tracking-wide uppercase text-muted-foreground">
              Base
            </h3>
            {bases.map((capa) => (
              <label key={capa.id} className="flex items-center gap-2 py-0.5">
                <input
                  type="radio"
                  name="capa-base"
                  checked={capa.id === baseActiva}
                  onChange={() => onCambiarBase(capa.id)}
                  className="accent-primary"
                />
                <span className="text-foreground">{capa.label}</span>
              </label>
            ))}
          </section>

          {superpuestas.length > 0 && (
            <section>
              <h3 className="mb-1.5 font-semibold tracking-wide uppercase text-muted-foreground">
                Superposiciones
              </h3>
              {superpuestas.map((capa) => {
                const visible = overlaysVisibles.includes(capa.id)
                const opacidad = opacidades[capa.id] ?? capa.opacity

                return (
                  <div key={capa.id} className="py-1">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`capa-${capa.id}`}
                        size="sm"
                        checked={visible}
                        onCheckedChange={() => onToggleOverlay(capa.id)}
                      />
                      <Label htmlFor={`capa-${capa.id}`}>{capa.label}</Label>
                    </div>

                    {visible && (
                      <div className="mt-1 flex items-center gap-2 pl-5">
                        <input
                          type="range"
                          min={10}
                          max={100}
                          step={5}
                          value={Math.round(opacidad * 100)}
                          onChange={(event) =>
                            onCambiarOpacidad(capa.id, Number(event.target.value) / 100)
                          }
                          aria-label={`Opacidad de ${capa.label}`}
                          className="flex-1 accent-primary"
                        />
                        <span className="w-8 text-right text-muted-foreground">
                          {Math.round(opacidad * 100)}%
                        </span>
                      </div>
                    )}

                    {visible && capa.attribution && (
                      <p className="mt-0.5 pl-5 text-xs text-muted-foreground">
                        {capa.attribution.replace(/<[^>]+>/g, '')}
                      </p>
                    )}
                  </div>
                )
              })}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
