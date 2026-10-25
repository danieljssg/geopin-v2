'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { CoberturaServicio, DensidadCelda, EquipamientoResumen, ResumenLevantamiento } from '@/lib/domain/dashboard'
import type { ParcelaEstado } from '@/lib/domain/types'
import type { PuntoMapa } from './MapaCalor'

/**
 * Dashboard del levantamiento.
 *
 * Todo lo que muestra sale del servidor: el avance contra el total esperado,
 * la cobertura por servicio con su déficit, el equipamiento y el mapa con
 * capas. No lee nada del IndexedDB del dispositivo, así que el administrador
 * ve el estado real del operativo y no lo que tiene su navegador.
 */

const MapaCalor = dynamic(() => import('./MapaCalor'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <p className="text-sm font-medium text-muted-foreground">Cargando mapa…</p>
    </div>
  ),
})

interface LevantamientoResumen {
  id: string
  nombre: string
  ciudad: string
  totalEsperado: number
}

/**
 * Pide los datos del dashboard.
 *
 * Fuera del componente: el efecto solo aplica el resultado.
 */
async function pedirDashboard(
  levantamientoId: string,
): Promise<{ datos?: DashboardData; error?: string }> {
  try {
    const url = levantamientoId
      ? `/api/dashboard?levantamientoId=${encodeURIComponent(levantamientoId)}`
      : '/api/dashboard'

    const respuesta = await fetch(url, { credentials: 'same-origin' })
    if (!respuesta.ok) return { error: `El servidor respondió ${respuesta.status}.` }

    return { datos: (await respuesta.json()) as DashboardData }
  } catch (caught) {
    return {
      error: caught instanceof Error ? caught.message : 'No se pudieron cargar los datos.',
    }
  }
}

interface DashboardData {
  levantamiento: LevantamientoResumen | null
  resumen: ResumenLevantamiento
  distribucion: Array<{ estado: ParcelaEstado; label: string; cantidad: number }>
  cobertura: CoberturaServicio[]
  equipamiento: EquipamientoResumen[]
  celdas: DensidadCelda[]
  puntos: PuntoMapa[]
}

export default function DashboardV2() {
  const [levantamientos, setLevantamientos] = useState<LevantamientoResumen[]>([])
  const [seleccionado, setSeleccionado] = useState<string>('')
  const [datos, setDatos] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  // El estado de carga se deriva de los datos: guardar la bandera en estado
  // obligaba a un setState dentro del efecto, que React 19 marca porque
  // provoca un render en cascada.
  const cargando = datos === null && error === null

  useEffect(() => {
    let vivo = true

    async function cargarLevantamientos() {
      try {
        const respuesta = await fetch('/api/levantamientos', { credentials: 'same-origin' })
        if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`)
        const { levantamientos: lista } = (await respuesta.json()) as {
          levantamientos: LevantamientoResumen[]
        }
        if (vivo) setLevantamientos(lista)
      } catch {
        // Sin campañas el dashboard igual funciona sobre todas las parcelas.
      }
    }

    void cargarLevantamientos()
    return () => {
      vivo = false
    }
  }, [])

  /**
   * El resultado se aplica en un `.then()`: un setState síncrono dentro del
   * efecto provoca un render en cascada, que es lo que marca React 19.
   */
  useEffect(() => {
    let vivo = true

    void pedirDashboard(seleccionado).then((resultado) => {
      if (!vivo) return
      if (resultado.datos) setDatos(resultado.datos)
      if (resultado.error) setError(resultado.error)
    })

    return () => {
      vivo = false
    }
  }, [seleccionado, recarga])

  const serviciosEnDeficit = useMemo(
    () => datos?.cobertura.filter((servicio) => servicio.enDeficit) ?? [],
    [datos],
  )

  const equipamientoSaturado = useMemo(
    () => datos?.equipamiento.filter((item) => item.saturado) ?? [],
    [datos],
  )

  return (
    <main className="min-h-screen bg-muted">
      <header className="bg-primary px-4 py-4 text-primary-foreground sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold">Dashboard del levantamiento</h1>
            <p className="text-xs text-primary-foreground/70">
              {datos?.levantamiento
                ? `${datos.levantamiento.nombre} — ${datos.levantamiento.ciudad}`
                : 'Todas las parcelas levantadas'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {levantamientos.length > 0 && (
              <Select
                value={seleccionado}
                onValueChange={(valor) => setSeleccionado(valor as string)}
              >
                <SelectTrigger
                  aria-label="Levantamiento"
                  size="sm"
                  className="bg-background text-foreground"
                >
                  <SelectValue>
                    {(valor) =>
                      valor
                        ? levantamientos.find((levantamiento) => levantamiento.id === valor)?.nombre
                        : 'Todas las parcelas'
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las parcelas</SelectItem>
                  {levantamientos.map((levantamiento) => (
                    <SelectItem key={levantamiento.id} value={levantamiento.id}>
                      {levantamiento.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <a
              href="/admin/esquema"
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className:
                  'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground',
              })}
            >
              Esquemas
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
        {cargando && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              <p>{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setError(null)
                  setRecarga((valor) => valor + 1)
                }}
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!cargando && datos && (
          <>
            {/* Avance contra el total esperado */}
            <Card>
              <CardContent>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Avance</p>
                    <p className="mt-1 text-2xl font-bold">
                      {datos.resumen.levantadas}{' '}
                      <span className="text-base font-medium text-muted-foreground">
                        de {datos.resumen.totalEsperado}
                      </span>
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-primary">
                    {datos.resumen.avancePct}%
                  </p>
                </div>

                <Progress value={datos.resumen.avancePct} className="mt-3" />

                <p className="mt-2 text-xs text-muted-foreground">
                  Faltan {datos.resumen.faltantes} parcelas para completar el levantamiento.
                </p>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  {datos.distribucion.map((item) => (
                    <div key={item.estado} className="rounded-lg bg-muted p-3">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-lg font-bold">{item.cantidad}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cobertura de servicios */}
            <Card>
              <CardHeader>
                <CardTitle>Cobertura de servicios</CardTitle>
                {serviciosEnDeficit.length > 0 && (
                  <CardAction>
                    <Badge variant="destructive">
                      {serviciosEnDeficit.length} en déficit
                    </Badge>
                  </CardAction>
                )}
                <CardDescription>
                  El porcentaje se calcula sobre las parcelas que declararon el servicio, no
                  sobre el total. Los casos sin dato se muestran aparte.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {datos.cobertura.map((servicio) => (
                  <div key={servicio.key}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">{servicio.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {servicio.cubiertas} de {servicio.declaradas} declaradas ·{' '}
                        <span className="font-semibold text-foreground">{servicio.coberturaPct}%</span>
                        {servicio.sinDato > 0 && ` · ${servicio.sinDato} sin dato`}
                      </p>
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={servicio.coberturaPct} className="flex-1" />
                      {servicio.enDeficit && <Badge variant="destructive">déficit</Badge>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Equipamiento */}
            <Card>
              <CardHeader>
                <CardTitle>Equipamiento urbano</CardTitle>
                {equipamientoSaturado.length > 0 && (
                  <CardAction>
                    <Badge variant="destructive">
                      {equipamientoSaturado.length} saturados
                    </Badge>
                  </CardAction>
                )}
              </CardHeader>

              <CardContent>
                {datos.equipamiento.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay parcelas con equipamiento declarado.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-1.5 pr-2">Tipo</th>
                        <th className="py-1.5 pr-2">Cantidad</th>
                        <th className="py-1.5 pr-2">Parcelas por unidad</th>
                        <th className="py-1.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.equipamiento.map((item) => (
                        <tr key={item.tipo} className="border-t">
                          <td className="py-1.5 pr-2">{item.tipo}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{item.cantidad}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{item.parcelasPorUnidad ?? '—'}</td>
                          <td className="py-1.5">
                            {item.saturado ? (
                              <Badge variant="destructive">saturado</Badge>
                            ) : (
                              <Badge variant="outline">ok</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {/* Mapa */}
            <Card>
              <CardHeader>
                <CardTitle>Mapa del levantamiento</CardTitle>
                <CardDescription>
                  {datos.puntos.length} parcelas · {datos.celdas.length} celdas de densidad
                </CardDescription>
              </CardHeader>
              <div className="h-120">
                <MapaCalor celdas={datos.celdas} puntos={datos.puntos} />
              </div>
            </Card>
          </>
        )}
      </div>
    </main>
  )
}
