'use client'

import { useEffect, useState } from 'react'
import { useSession } from '@/lib/auth-client'
import { useSync } from '@/components/field/SyncProvider'
import { Button } from '@/components/ui/button'

interface SurveyOption { id: string; nombre: string; ciudad: string }
interface DashboardSnapshot { territorio: { pines: number }; categorias: Array<{ categoria: string; cantidad: number; porcentaje: number }>; cachedAt?: string }

export default function MicroDashboard() {
  const session = useSession()
  const sync = useSync()
  const userId = session.data?.user?.id
  const [surveys, setSurveys] = useState<SurveyOption[]>([])
  const [surveyId, setSurveyId] = useState('')
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null)
  const [offline, setOffline] = useState(false)
  const [percent, setPercent] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) return
    let alive = true
    const key = `geopin-surveys:${userId}`
    void fetch('/api/levantamientos', { credentials: 'same-origin' }).then(async (response) => {
      if (!response.ok) throw new Error('No se pudo cargar la lista.')
      const body = await response.json() as { levantamientos: SurveyOption[] }
      if (!alive) return
      setSurveys(body.levantamientos)
      localStorage.setItem(key, JSON.stringify(body.levantamientos))
      const activeKey = `geopin-active-survey:${userId}`
      const stored = localStorage.getItem(activeKey) ?? ''
      const next = body.levantamientos.some((survey) => survey.id === stored) ? stored : body.levantamientos[0]?.id ?? ''
      setSurveyId(next)
      if (next) localStorage.setItem(activeKey, next)
    }).catch(() => {
      const cached = localStorage.getItem(key)
      if (!alive) return
      if (cached) {
        const rows = JSON.parse(cached) as SurveyOption[]
        setSurveys(rows)
        const stored = localStorage.getItem(`geopin-active-survey:${userId}`) ?? ''
        setSurveyId(rows.some((survey) => survey.id === stored) ? stored : rows[0]?.id ?? '')
      } else setError('Conéctate para cargar tus levantamientos.')
    })
    return () => { alive = false }
  }, [userId])

  useEffect(() => {
    if (!userId || !surveyId) return
    let alive = true
    const key = `geopin-microdashboard:${userId}:${surveyId}`
    void fetch(`/api/dashboard?levantamientoId=${encodeURIComponent(surveyId)}`, { credentials: 'same-origin' }).then(async (response) => {
      if (!response.ok) throw new Error('No se pudo actualizar el resumen.')
      const data = await response.json() as DashboardSnapshot
      if (!alive) return
      const saved = { ...data, cachedAt: new Date().toISOString() }
      setSnapshot(saved); setOffline(false); setError('')
      localStorage.setItem(key, JSON.stringify(saved))
    }).catch(() => {
      const cached = localStorage.getItem(key)
      if (!alive) return
      if (cached) {
        setSnapshot(JSON.parse(cached) as DashboardSnapshot)
        setOffline(true)
      } else setError('Este levantamiento aún no tiene un resumen guardado para consultar sin conexión.')
    })
    return () => { alive = false }
  }, [userId, surveyId])

  return <section className="mx-auto max-w-3xl space-y-5 p-6"><div><h1 className="text-2xl font-semibold">Mi resumen</h1><p className="text-sm text-muted-foreground">Solo tus registros en el levantamiento activo.</p></div>
    <label className="grid max-w-md gap-1 text-sm">Levantamiento activo<select className="h-10 rounded-md border bg-background px-3" value={surveyId} onChange={(event) => { setSurveyId(event.target.value); if (userId) localStorage.setItem(`geopin-active-survey:${userId}`, event.target.value) }}><option value="">Selecciona un levantamiento</option>{surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.nombre} — {survey.ciudad}</option>)}</select></label>
    {offline && <p role="status" className="rounded-md border p-3 text-sm">Resumen guardado {snapshot?.cachedAt ? new Date(snapshot.cachedAt).toLocaleString() : ''}. Puede estar desactualizado.</p>}
    {sync.pendientes > 0 && <p role="status" className="rounded-md border p-3 text-sm">{sync.pendientes} registros pendientes de sincronización.</p>}
    {snapshot && <><div className="rounded-xl border bg-background p-5"><p className="text-sm text-muted-foreground">Pines levantados por ti</p><p className="text-3xl font-bold">{snapshot.territorio.pines}</p></div><div className="rounded-xl border bg-background p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Desglose por categoría</h2><Button variant="outline" size="sm" onClick={() => setPercent((value) => !value)}>{percent ? 'Ver cantidades' : 'Ver porcentajes'}</Button></div>{snapshot.categorias.map((row) => <div key={row.categoria} className="flex justify-between border-t py-2 text-sm"><span>{row.categoria}</span><strong>{percent ? `${row.porcentaje}%` : row.cantidad}</strong></div>)}</div></>}
    {error && <p role="status" className="text-sm text-muted-foreground">{error}</p>}
  </section>
}
