'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { List, Map as MapIcon } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ParcelaEstado } from '@/lib/domain/types'
import { redirigirSiNoHaySesion } from '@/lib/field/sesion'

/**
 * Lista de parcelas levantadas.
 *
 * Es la vista que le falta a la app v2 para reemplazar al prototipo: el
 * levantador tiene que ver lo que ya capturó, cambiar el estado de cada
 * parcela, ver a qué campaña pertenece, corregirla y borrar lo mal capturado.
 *
 * Editar y borrar van contra el servidor. Los cambios de una sesión sin
 * conexión pasan por la cola, igual que la captura.
 */

const MapaListado = dynamic(() => import('@/components/admin/MapaCalor'), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> })

interface ParcelaFila {
  id: string
  nombre: string
  codigo?: string
  categoria: string
  estado: ParcelaEstado
  levantamientoId?: string
  lat: number
  lng: number
  areaM2?: number
  creadoEn: string
  actualizadoEn: string
}

/**
 * Pide la lista al servidor.
 *
 * Vive fuera del componente a propósito: así el efecto solo aplica el
 * resultado y no hay un `setState` en su cuerpo.
 */
async function pedirParcelas(
  mias: boolean,
): Promise<{ parcelas?: ParcelaFila[]; error?: string }> {
  try {
    const parcelas: ParcelaFila[] = []
    let total = Infinity
    while (parcelas.length < total) {
      const consulta = `/api/parcelas?limite=200&skip=${parcelas.length}${mias ? '&mias=1' : ''}`
      const respuesta = await fetch(consulta, { credentials: 'same-origin', cache: 'no-store' })
      if (redirigirSiNoHaySesion(respuesta.status)) return { error: 'Necesitas iniciar sesión para ver las parcelas.' }
      if (!respuesta.ok) return { error: `El servidor respondió ${respuesta.status}.` }
      const cuerpo = await respuesta.json() as { parcelas?: ParcelaFila[]; total: number }
      const pagina = cuerpo.parcelas ?? []
      parcelas.push(...pagina)
      total = cuerpo.total
      if (!pagina.length) break
    }
    return { parcelas }
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : 'No se pudo cargar la lista.' }
  }
}

interface LevantamientoOp {
  id: string
  nombre: string
}

/**
 * Pide las campañas para la columna y el selector de levantamiento: la API
 * de parcelas devuelve solo el id. Si falla, la columna muestra "—" y no
 * bloquea el listado.
 */
async function pedirLevantamientos(): Promise<LevantamientoOp[]> {
  try {
    const respuesta = await fetch('/api/levantamientos', { credentials: 'same-origin' })
    if (!respuesta.ok) return []
    const cuerpo = (await respuesta.json()) as { levantamientos?: LevantamientoOp[] }
    return cuerpo.levantamientos ?? []
  } catch {
    return []
  }
}

const ETIQUETAS: Record<ParcelaEstado, string> = {
  completa: 'Completada',
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
}

const FILTROS: Record<string, string> = {
  '': 'Todos los estados',
  completa: 'Completadas',
  pendiente: 'Pendientes',
  en_revision: 'En revisión',
}

export default function ListaParcelas() {
  return (
    <Suspense
      fallback={<ListaParcelasSkeleton />}
    >
      <ListaParcelasContenido />
    </Suspense>
  )
}

function ListaParcelasSkeleton() {
  return (
    <div className="space-y-4" aria-label="Cargando parcelas" role="status">
      <Skeleton className="h-10 w-full sm:max-w-md" />
      <div className="overflow-hidden rounded-xl border bg-card p-3 sm:p-4">
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="hidden h-9 w-28 sm:block" />
              <Skeleton className="h-9 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ListaParcelasContenido() {
  const searchParams = useSearchParams()
  // `mias=1` es el atajo de "Mis registros": el servidor lo traduce al dueño
  // de la sesión, así que el cliente no manda ningún id de usuario.
  const mias = searchParams.get('mias') === '1'

  const [parcelas, setParcelas] = useState<ParcelaFila[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // El estado de carga se deriva de los datos: si todavía no hay lista, la
  // primera carga sigue en curso. Guardarlo en estado obligaba a un setState
  // dentro del efecto, que React 19 marca porque provoca un render en cascada.
  const cargando = parcelas === null && error === null
  const [vista, setVista] = useState<'lista' | 'mapa'>('lista')
  const [filtro, setFiltro] = useState<ParcelaEstado | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [eliminando, setEliminando] = useState<string | null>(null)
  const [parcheando, setParcheando] = useState<string | null>(null)
  // Campañas disponibles para la columna y el selector de levantamiento.
  const [levantamientos, setLevantamientos] = useState<LevantamientoOp[]>([])
  const nombreDeLevantamiento = useMemo(
    () => new Map(levantamientos.map((levantamiento) => [levantamiento.id, levantamiento.nombre])),
    [levantamientos],
  )

  const [recarga, setRecarga] = useState(0)

  /**
   * La carga inicial aplica el resultado en un `.then()`, no dentro del
   * cuerpo del efecto: un setState síncrono ahí provoca un render en
   * cascada, que es lo que marca React 19.
   */
  useEffect(() => {
    let vivo = true

    void pedirParcelas(mias).then((resultado) => {
      if (!vivo) return
      if (resultado.parcelas) setParcelas(resultado.parcelas)
      if (resultado.error) setError(resultado.error)
    })

    return () => {
      vivo = false
    }
  }, [recarga, mias])

  useEffect(() => {
    let vivo = true

    void pedirLevantamientos().then((campanias) => {
      if (vivo) setLevantamientos(campanias)
    })

    return () => {
      vivo = false
    }
  }, [recarga])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return (parcelas ?? []).filter((parcela) => {
      if (filtro && parcela.estado !== filtro) return false
      if (texto === '') return true
      return (
        parcela.nombre.toLowerCase().includes(texto) ||
        (parcela.codigo ?? '').toLowerCase().includes(texto)
      )
    })
  }, [parcelas, filtro, busqueda])

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta parcela? La acción no se puede deshacer.')) return

    setEliminando(id)
    try {
      const respuesta = await fetch(`/api/parcelas/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!respuesta.ok) {
        const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string }
        throw new Error(cuerpo.error ?? `El servidor respondió ${respuesta.status}.`)
      }
      setParcelas((previas) => (previas ?? []).filter((parcela) => parcela.id !== id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar.')
    } finally {
      setEliminando(null)
    }
  }

  /**
   * Envia un parche contra el servidor y refleja los campos cambiados en la
   * fila. Un error cae en la misma alerta del listado.
   */
  async function parchear(id: string, cambios: Record<string, unknown>, mensajeError: string) {
    setParcheando(id)
    try {
      const respuesta = await fetch(`/api/parcelas/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
      })
      if (!respuesta.ok) {
        const fallo = (await respuesta.json().catch(() => ({}))) as { error?: string }
        throw new Error(fallo.error ?? `El servidor respondió ${respuesta.status}.`)
      }
      setParcelas((previas) =>
        (previas ?? []).map((parcela) =>
          parcela.id === id ? { ...parcela, ...(cambios as Partial<ParcelaFila>) } : parcela,
        ),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : mensajeError)
    } finally {
      setParcheando(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Vista del listado" className="flex gap-2">
          <Button variant={vista === 'lista' ? 'default' : 'outline'} aria-pressed={vista === 'lista'} onClick={() => setVista('lista')}><List /> Lista</Button>
          <Button variant={vista === 'mapa' ? 'default' : 'outline'} aria-pressed={vista === 'mapa'} onClick={() => setVista('mapa')}><MapIcon /> Mapa online</Button>
        </div>
        {vista === 'mapa' && <span className="text-xs text-muted-foreground">Cartografía online · Todos los registros accesibles a tu cuenta</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {mias && <Badge variant="secondary">Mis registros</Badge>}

        <Input
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por nombre o código"
          aria-label="Buscar parcelas"
          className="w-full sm:w-60"
        />

        <Select
          value={filtro}
          onValueChange={(value) => setFiltro((value ?? '') as ParcelaEstado | '')}
        >
          <SelectTrigger aria-label="Filtrar por estado" className="w-full sm:w-44">
            <SelectValue>{(value) => FILTROS[value as string] ?? FILTROS['']}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FILTROS).map(([value, etiqueta]) => (
              <SelectItem key={value} value={value}>
                {etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">
          {visibles.length} de {parcelas?.length ?? 0}
        </span>

        <div className="ml-auto flex gap-2">
          {(['geojson', 'csv', 'xlsx', 'shp'] as const).map((formato) => (
            <a
              key={formato}
              href={`/api/export?format=${formato}`}
              className={buttonVariants({ variant: 'outline', size: 'xs' })}
            >
              {formato === 'shp' ? 'SHP' : formato.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{error}</p>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="mt-1"
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

      {cargando && <ListaParcelasSkeleton />}

      {!cargando && !error && visibles.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {(parcelas?.length ?? 0) === 0
            ? 'Todavía no hay parcelas levantadas.'
            : 'Ninguna parcela coincide con el filtro.'}
        </p>
      )}

      {!cargando && !error && vista === 'mapa' && visibles.length > 0 && <div className="theme-map-light relative isolate h-[65dvh] min-h-96 overflow-hidden rounded-sm border" aria-label="Mapa de parcelas levantadas"><MapaListado celdas={[]} puntos={visibles.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng))} /></div>}

      {!cargando && vista === 'lista' && visibles.length > 0 && (
        <Card size="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs tracking-wide uppercase text-muted-foreground">
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Levantamiento</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Área</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibles.map((parcela) => (
                  <tr key={parcela.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{parcela.nombre}</td>
                    <td className="px-3 py-2 text-muted-foreground">{parcela.codigo ?? '—'}</td>
                    <td className="px-3 py-2">
                      {levantamientos.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <Select
                          value={parcela.levantamientoId ?? ''}
                          onValueChange={(valor) => {
                            if (typeof valor === 'string' && valor !== '') {
                              void parchear(
                                parcela.id,
                                { levantamientoId: valor },
                                'No se pudo asignar el levantamiento.',
                              )
                            }
                          }}
                        >
                          <SelectTrigger
                            aria-label={`Levantamiento de ${parcela.nombre}`}
                            size="sm"
                            className="w-40"
                            disabled={parcheando === parcela.id}
                          >
                            <SelectValue>
                              {(value) =>
                                value
                                  ? (nombreDeLevantamiento.get(value as string) ?? '—')
                                  : 'Sin campaña'
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {levantamientos.map((levantamiento) => (
                              <SelectItem key={levantamiento.id} value={levantamiento.id}>
                                {levantamiento.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={parcela.estado}
                        onValueChange={(valor) => {
                          if (valor) {
                            void parchear(
                              parcela.id,
                              { estado: valor as ParcelaEstado },
                              'No se pudo cambiar el estado.',
                            )
                          }
                        }}
                      >
                        <SelectTrigger
                          aria-label={`Cambiar estado de ${parcela.nombre}`}
                          size="sm"
                          className="w-36"
                          disabled={parcheando === parcela.id}
                        >
                          <SelectValue>{(value) => ETIQUETAS[value as ParcelaEstado]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ETIQUETAS).map(([value, etiqueta]) => (
                            <SelectItem key={value} value={value}>
                              {etiqueta}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {parcela.areaM2 !== undefined
                        ? `${parcela.areaM2.toLocaleString('es-VE')} m²`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(parcela.creadoEn).toLocaleDateString('es-VE')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <Link
                          href={`/campo?parcela=${encodeURIComponent(parcela.id)}`}
                          className={buttonVariants({ variant: 'outline', size: 'xs' })}
                        >
                          Editar
                        </Link>
                        <Button
                          type="button"
                          variant="destructive"
                          size="xs"
                          onClick={() => void eliminar(parcela.id)}
                          disabled={eliminando === parcela.id}
                        >
                          {eliminando === parcela.id ? '…' : 'Eliminar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
