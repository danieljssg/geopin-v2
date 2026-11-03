'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import type { CoberturaServicio, DensidadCelda, EquipamientoResumen, ResumenLevantamiento, ResumenTerritorial } from '@/lib/domain/dashboard'
import type { ParcelaEstado } from '@/lib/domain/types'
import type { PuntoMapa } from './MapaCalor'
import { CATEGORIAS_LIST } from '@/lib/categories'
import { ESTADOS_CONSTRUCCION, MATERIALES, USOS_GENERALES, USOS_ESPECIFICOS } from '@/lib/urban-options'
import { useSession } from '@/lib/auth-client'

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
    <div className="relative h-72 w-full overflow-hidden rounded-xl bg-muted" aria-label="Cargando mapa de densidad" role="status">
      <Skeleton className="absolute inset-0 rounded-none" />
      <Skeleton className="absolute left-1/4 top-1/4 size-24 rounded-full opacity-60" />
      <Skeleton className="absolute bottom-8 right-1/4 size-32 rounded-full opacity-50" />
    </div>
  ),
})

interface LevantamientoResumen {
  id: string
  nombre: string
  ciudad: string
  totalEsperado: number
  workspaceId?: string
  propietarioId?: string
}
interface WorkspaceResumen { id: string; nombre: string }

/**
 * Pide los datos del dashboard.
 *
 * Fuera del componente: el efecto solo aplica el resultado.
 */
async function pedirDashboard(
  levantamientoId: string,
  filters: DashboardFilters,
): Promise<{ datos?: DashboardData; error?: string }> {
  try {
    const query = new URLSearchParams({ levantamientoId, dateField: filters.dateField })
    if (filters.from) query.set('from', filters.from)
    if (filters.to) query.set('to', filters.to)
    for (const [key, values] of Object.entries(filters)) {
      if (key === 'dateField' || key === 'from' || key === 'to') continue
      for (const value of values) query.append(key, value)
    }
    const url = `/api/dashboard?${query}`

    const respuesta = await fetch(url, { credentials: 'same-origin' })
    if (!respuesta.ok) return { error: `El servidor respondió ${respuesta.status}.` }

    return { datos: (await respuesta.json()) as DashboardData }
  } catch (caught) {
    return {
      error: caught instanceof Error ? caught.message : 'No se pudieron cargar los datos.',
    }
  }
}

interface DashboardFilters {
  dateField: 'createdAt' | 'updatedAt'
  from: string
  to: string
  category: string[]
  generalUse: string[]
  specificUse: string[]
  constructionCondition: string[]
  floors: string[]
  material: string[]
}

const EMPTY_FILTERS: DashboardFilters = { dateField: 'createdAt', from: '', to: '', category: [], generalUse: [], specificUse: [], constructionCondition: [], floors: [], material: [] }

function MultiFilter({ label, values, selected, onChange }: { label: string; values: readonly { value: string; label: string }[]; selected: string[]; onChange: (values: string[]) => void }) {
  return <label className="grid gap-1 text-xs font-medium">{label}<select multiple value={selected} onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))} className="min-h-20 rounded-md border bg-background p-2 text-sm" aria-label={label}>{values.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
}

const LABEL_OPTIONS = (options: readonly { value: string; label: string }[]) => options.map(({ label }) => ({ value: label, label }))
const SPECIFIC_BY_GENERAL: Record<string, string[]> = {
  Residencial: ['Unifamiliar', 'Bifamiliar', 'Multifamiliar'],
  Comercial: ['Comercio formal', 'Comercio informal'],
  Equipamiento: ['Asistencial', 'Educativo', 'Seguridad y administrativo', 'Recreación y deportivo'],
  'Espacio público': ['Área verde', 'Cultural', 'Recreación y deportivo'],
}

interface DashboardData {
  levantamiento: LevantamientoResumen | null
  resumen: ResumenLevantamiento
  territorio: ResumenTerritorial
  categorias: Array<{ categoria: string; cantidad: number; porcentaje: number }>
  analisis: Array<{ field: string; label: string; denominator: number; values: Array<{ value: string; count: number; percentage: number }> }>
  distribucion: Array<{ estado: ParcelaEstado; label: string; cantidad: number }>
  cobertura: CoberturaServicio[]
  equipamiento: EquipamientoResumen[]
  celdas: DensidadCelda[]
  puntos: PuntoMapa[]
  cachedAt?: string
}

export default function DashboardV2() {
  const session = useSession()
  const userId = session.data?.user?.id
  const [levantamientos, setLevantamientos] = useState<LevantamientoResumen[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceResumen[]>([])
  const [workspaceActivo, setWorkspaceActivo] = useState('')
  const [seleccionado, setSeleccionado] = useState<string>('')
  const [datos, setDatos] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recarga, setRecarga] = useState(0)
  const [filters, setFilters] = useState<DashboardFilters>(EMPTY_FILTERS)
  const [mostrarPorcentaje, setMostrarPorcentaje] = useState(false)
  const [offlineSnapshot, setOfflineSnapshot] = useState(false)
  // El estado de carga se deriva de los datos: guardar la bandera en estado
  // obligaba a un setState dentro del efecto, que React 19 marca porque
  // provoca un render en cascada.
  const cargando = datos === null && error === null && Boolean(seleccionado)
  const snapshotKey = useMemo(() => `geopin-dashboard:${userId ?? 'unknown'}:${seleccionado}:${JSON.stringify(filters)}`, [filters, seleccionado, userId])

  useEffect(() => {
    let vivo = true

    async function cargarLevantamientos() {
      try {
        const respuesta = await fetch('/api/levantamientos', { credentials: 'same-origin' })
        if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`)
        const { levantamientos: lista } = (await respuesta.json()) as {
          levantamientos: LevantamientoResumen[]
        }
        if (vivo) {
          setLevantamientos(lista)
          setSeleccionado((actual) => actual || lista[0]?.id || '')
          if (userId) localStorage.setItem(`geopin-surveys:${userId}`, JSON.stringify(lista))
          setError(null)
        }
      } catch {
        const cached = userId ? localStorage.getItem(`geopin-surveys:${userId}`) : null
        if (!vivo) return
        if (cached) {
          try {
            const lista = JSON.parse(cached) as LevantamientoResumen[]
            setLevantamientos(lista)
            const active = lista[0]?.id ?? ''
            if (active) setSeleccionado((current) => current || active)
            else setError('No hay levantamientos guardados en este dispositivo.')
          } catch { setError('No se pudo leer la lista local de levantamientos.') }
        } else setError('No se pudo cargar la lista de levantamientos.')
      }
    }

    void cargarLevantamientos()
    return () => {
      vivo = false
    }
  }, [userId])

  useEffect(() => {
    if (userId && seleccionado) localStorage.setItem(`geopin-active-survey:${userId}`, seleccionado)
  }, [seleccionado, userId])

  useEffect(() => {
    let alive = true
    void fetch('/api/workspaces', { credentials: 'same-origin' }).then(async (response) => {
      if (!response.ok) return
      const body = await response.json() as { workspaces: WorkspaceResumen[] }
      if (alive) {
        setWorkspaces(body.workspaces)
        if (userId) localStorage.setItem(`geopin-workspaces:${userId}`, JSON.stringify(body.workspaces))
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [userId])

  const levantamientosVisibles = useMemo(() => {
    if (!workspaceActivo) return levantamientos
    if (workspaceActivo === '__personal__') return levantamientos.filter((item) => !item.workspaceId)
    return levantamientos.filter((item) => item.workspaceId === workspaceActivo)
  }, [levantamientos, workspaceActivo])

  /**
   * El resultado se aplica en un `.then()`: un setState síncrono dentro del
   * efecto provoca un render en cascada, que es lo que marca React 19.
   */
  useEffect(() => {
    let vivo = true

    if (!seleccionado) return () => { vivo = false }

    void pedirDashboard(seleccionado, filters).then((resultado) => {
      if (!vivo) return
      if (resultado.datos) {
        const snapshot = { ...resultado.datos, cachedAt: new Date().toISOString() }
        setDatos(snapshot); setOfflineSnapshot(false); setError(null)
        if (userId) localStorage.setItem(snapshotKey, JSON.stringify(snapshot))
      } else {
        const saved = userId ? localStorage.getItem(snapshotKey) : null
        if (saved) {
          try { setDatos(JSON.parse(saved) as DashboardData); setOfflineSnapshot(true); setError(null) }
          catch { setError(resultado.error ?? 'No se pudo actualizar el dashboard.') }
        } else setError(resultado.error ?? 'No se pudo actualizar el dashboard.')
      }
    })

    return () => {
      vivo = false
    }
  }, [seleccionado, recarga, filters, snapshotKey, userId])

  const exportQuery = useMemo(() => {
    const query = new URLSearchParams({ format: 'xlsx', levantamientoId: seleccionado, dateField: filters.dateField })
    if (filters.from) query.set('from', filters.from)
    if (filters.to) query.set('to', filters.to)
    for (const [key, values] of Object.entries(filters)) if (Array.isArray(values)) for (const value of values) query.append(key, value)
    return query.toString()
  }, [filters, seleccionado])

  const serviciosEnDeficit = useMemo(
    () => datos?.cobertura.filter((servicio) => servicio.enDeficit) ?? [],
    [datos],
  )

  const equipamientoSaturado = useMemo(
    () => datos?.equipamiento.filter((item) => item.saturado) ?? [],
    [datos],
  )
  const opcionesUsoEspecifico = useMemo(() => {
    const validas = filters.generalUse.flatMap((value) => SPECIFIC_BY_GENERAL[value] ?? [])
    return LABEL_OPTIONS(USOS_ESPECIFICOS).filter((option) => validas.length === 0 || validas.includes(option.value))
  }, [filters.generalUse])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {datos?.levantamiento
            ? `${datos.levantamiento.nombre} — ${datos.levantamiento.ciudad}`
            : 'Todas las parcelas levantadas'}
        </p>

        <div className="flex flex-wrap gap-2">
        {workspaces.length > 0 && (
          <Select value={workspaceActivo} onValueChange={(value) => { const next = value as string; setWorkspaceActivo(next); const surveys = !next ? levantamientos : next === '__personal__' ? levantamientos.filter((item) => !item.workspaceId) : levantamientos.filter((item) => item.workspaceId === next); setSeleccionado(surveys[0]?.id ?? '') }}>
            <SelectTrigger aria-label="Entorno" size="sm" className="bg-background text-foreground"><SelectValue>{(value) => value ? (value === '__personal__' ? 'Personal / global' : workspaces.find((workspace) => workspace.id === value)?.nombre ?? 'Entorno') : 'Todos los entornos'}</SelectValue></SelectTrigger>
            <SelectContent><SelectItem value="">Todos los entornos</SelectItem>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.nombre}</SelectItem>)}<SelectItem value="__personal__">Personal / global</SelectItem></SelectContent>
          </Select>
        )}
        {levantamientosVisibles.length > 0 && (
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
                    ? levantamientosVisibles.find((levantamiento) => levantamiento.id === valor)?.nombre
                    : 'Selecciona un levantamiento'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {levantamientosVisibles.map((levantamiento) => (
                <SelectItem key={levantamiento.id} value={levantamiento.id}>
                  {levantamiento.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        </div>
      </div>

      <Card><CardHeader><CardTitle>Filtros del levantamiento</CardTitle><CardDescription>Las métricas, el mapa y la exportación usan estos filtros. Las fechas usan la hora local de Venezuela (UTC−4).</CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs font-medium">Filtrar fecha por<select className="h-9 rounded-md border bg-background px-2 text-sm" value={filters.dateField} onChange={(e) => setFilters((old) => ({ ...old, dateField: e.target.value as DashboardFilters['dateField'] }))}><option value="createdAt">Creación del registro</option><option value="updatedAt">Última modificación</option></select></label>
          <label className="grid gap-1 text-xs font-medium">Desde<input type="date" className="h-9 rounded-md border bg-background px-2 text-sm" value={filters.from} onChange={(e) => setFilters((old) => ({ ...old, from: e.target.value }))} /></label>
          <label className="grid gap-1 text-xs font-medium">Hasta<input type="date" className="h-9 rounded-md border bg-background px-2 text-sm" value={filters.to} onChange={(e) => setFilters((old) => ({ ...old, to: e.target.value }))} /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MultiFilter label="Categorías" values={CATEGORIAS_LIST} selected={filters.category} onChange={(category) => setFilters((old) => ({ ...old, category }))} />
          <MultiFilter label="Uso general" values={LABEL_OPTIONS(USOS_GENERALES)} selected={filters.generalUse} onChange={(generalUse) => setFilters((old) => ({ ...old, generalUse, specificUse: [] }))} />
          <MultiFilter label="Uso específico" values={opcionesUsoEspecifico} selected={filters.specificUse} onChange={(specificUse) => setFilters((old) => ({ ...old, specificUse }))} />
          <MultiFilter label="Estado de construcción" values={LABEL_OPTIONS(ESTADOS_CONSTRUCCION)} selected={filters.constructionCondition} onChange={(constructionCondition) => setFilters((old) => ({ ...old, constructionCondition }))} />
          <MultiFilter label="Pisos" values={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} selected={filters.floors} onChange={(floors) => setFilters((old) => ({ ...old, floors }))} />
          <MultiFilter label="Materiales" values={LABEL_OPTIONS(MATERIALES)} selected={filters.material} onChange={(material) => setFilters((old) => ({ ...old, material }))} />
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>Limpiar filtros</Button>{seleccionado && <a className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-accent" href={`/api/export?${exportQuery}`}>Exportar resultados a Excel</a>}</div>
      </CardContent></Card>
      {offlineSnapshot && <p role="status" className="rounded-md border bg-background p-3 text-sm">Dashboard guardado {datos?.cachedAt ? new Date(datos.cachedAt).toLocaleString() : ''}. Puede estar desactualizado.</p>}

      {cargando && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!seleccionado && !error && <Card><CardHeader><CardTitle>No hay levantamientos en este entorno</CardTitle><CardDescription>Crea un levantamiento desde Gestión del entorno para comenzar. Aquí aparecerán sus métricas cuando captures registros.</CardDescription></CardHeader></Card>}
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

      {!cargando && datos && seleccionado && (
        <>
          {datos.territorio.pines === 0 && <Card><CardHeader><CardTitle>No hay registros para este levantamiento y estos filtros</CardTitle><CardDescription>Captura registros o ajusta los filtros para ver las métricas.</CardDescription></CardHeader></Card>}
          <Card><CardHeader><CardTitle>Registros por categoría</CardTitle><CardAction><Button variant="outline" size="sm" onClick={() => setMostrarPorcentaje((value) => !value)}>{mostrarPorcentaje ? 'Ver cantidades' : 'Ver porcentajes'}</Button></CardAction></CardHeader><CardContent className="space-y-2">{datos.categorias.length === 0 ? <p className="text-sm text-muted-foreground">No hay registros para estos filtros.</p> : datos.categorias.map((item) => <div key={item.categoria} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{item.categoria}</span><strong>{mostrarPorcentaje ? `${item.porcentaje}%` : item.cantidad}</strong></div>)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Resumen analítico</CardTitle><CardDescription>Porcentajes calculados sobre los registros que respondieron cada campo. En materiales, un registro puede aportar más de un valor.</CardDescription><CardAction><Button variant="outline" size="sm" onClick={() => setMostrarPorcentaje((value) => !value)}>{mostrarPorcentaje ? 'Ver cantidades' : 'Ver porcentajes'}</Button></CardAction></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{datos.analisis.map((group) => <section key={group.field} className="rounded-lg border p-3"><h3 className="font-semibold">{group.label}</h3><p className="text-xs text-muted-foreground">Base: {group.denominator} registros válidos</p>{group.values.length ? group.values.map((item) => <div key={item.value} className="flex justify-between gap-3 border-t py-1.5 text-sm"><span>{item.value}</span><strong>{mostrarPorcentaje ? `${item.percentage}%` : item.count}</strong></div>) : <p className="py-2 text-sm text-muted-foreground">Sin respuestas</p>}</section>)}</CardContent></Card>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="pt-5"><p className="text-xs font-semibold uppercase text-muted-foreground">Pines en el levantamiento</p><p className="mt-1 text-2xl font-bold">{datos.territorio.pines.toLocaleString('es-VE')}</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs font-semibold uppercase text-muted-foreground">Superficie reportada</p><p className="mt-1 text-2xl font-bold">{datos.territorio.superficieM2.toLocaleString('es-VE')} m²</p><p className="text-xs text-muted-foreground">{datos.territorio.parcelasConSuperficie} registros con superficie</p></CardContent></Card>
            <Card><CardContent className="pt-5"><p className="text-xs font-semibold uppercase text-muted-foreground">Población estimada</p><p className="mt-1 text-2xl font-bold">{datos.territorio.poblacionEstimada === null ? 'Sin campo cuantitativo' : datos.territorio.poblacionEstimada.toLocaleString('es-VE')}</p><p className="text-xs text-muted-foreground">{datos.territorio.registrosConPoblacion} registros numéricos</p></CardContent></Card>
          </div>
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
          <Card><CardHeader><CardTitle>Resultados filtrados</CardTitle><CardDescription>{datos.puntos.length} registros en este resultado; se muestran los primeros 100.</CardDescription></CardHeader><CardContent><div className="max-h-96 overflow-auto"><table className="w-full text-sm"><thead className="sticky top-0 bg-background text-left"><tr><th className="p-2">Nombre</th><th className="p-2">Categoría</th><th className="p-2">Estado</th></tr></thead><tbody>{datos.puntos.slice(0, 100).map((punto) => <tr key={punto.id} className="border-t"><td className="p-2">{punto.nombre}</td><td className="p-2">{punto.categoria ?? '—'}</td><td className="p-2">{punto.estado}</td></tr>)}</tbody></table></div></CardContent></Card>

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
  )
}
