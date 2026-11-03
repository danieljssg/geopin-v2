'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSession } from '@/lib/auth-client'

type SurveyRow = { id: string; nombre: string }

type RequestRow = { _id: string; userId: string; nombreWorkspace: string; proposito: string; participantesEsperados: number; estado: string }
type InvitationRow = { _id: string; targetType: string; targetId: string; expiraEn: string; revocado: boolean }

export default function ManagerPortal() {
  const session = useSession()
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [workspaceName, setWorkspaceName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [participants, setParticipants] = useState('')
  const [targetId, setTargetId] = useState('')
  const [invite, setInvite] = useState<{ code: string; link: string } | null>(null)
  const [surveyName, setSurveyName] = useState('')
  const [surveyCity, setSurveyCity] = useState('')
  const [surveyGoal, setSurveyGoal] = useState('0')
  const [surveys, setSurveys] = useState<SurveyRow[]>([])
  const [fieldSurveyId, setFieldSurveyId] = useState('')
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldType, setFieldType] = useState<'texto' | 'entero' | 'decimal' | 'booleano' | 'lista' | 'fecha'>('texto')
  const [fieldOptions, setFieldOptions] = useState('')
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const userId = session.data?.user?.id
  const loadSurveys = useCallback(async () => {
    const response = await fetch('/api/levantamientos', { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw new Error('No se pudieron cargar los levantamientos del entorno.')
    const data = await response.json() as { levantamientos: SurveyRow[] }
    return data.levantamientos
  }, [])

  useEffect(() => {
    if (!userId) return
    let alive = true
    void loadSurveys().then((items) => { if (alive) setSurveys(items) }).catch((error: Error) => { if (alive) setStatus(error.message) })
    return () => { alive = false }
  }, [userId, loadSurveys])

  async function loadRequests() {
    const response = await fetch('/api/manager-requests', { credentials: 'same-origin' })
    if (!response.ok) return
    const data = await response.json() as { solicitudes: RequestRow[] }
    setRequests(data.solicitudes)
  }

  async function submitRequest(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus('')
    try {
      const response = await fetch('/api/manager-requests', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombreWorkspace: workspaceName, proposito: purpose, participantesEsperados: Number(participants) }) })
      const data = await response.json() as { error?: string }
      setStatus(response.ok ? 'Solicitud enviada al administrador.' : data.error ?? 'No se pudo enviar la solicitud.')
    } catch { setStatus('No se pudo contactar al servidor.') } finally { setBusy(false) }
  }

  async function decide(id: string, decision: 'aprobada' | 'rechazada') {
    const response = await fetch('/api/manager-requests', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, decision }) })
    if (response.ok) await loadRequests()
  }

  async function createInvite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus('')
    try {
      const response = await fetch('/api/invitations', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(targetId ? { targetType: 'survey', targetId } : { targetType: 'workspace' }) })
      const data = await response.json() as { code?: string; link?: string; error?: string }
      if (!response.ok || !data.code || !data.link) { setStatus(data.error ?? 'No se pudo crear la invitación.'); return }
      setInvite({ code: data.code, link: data.link })
    } catch { setStatus('No se pudo contactar al servidor.') } finally { setBusy(false) }
  }

  async function createSurvey(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus('')
    try {
      const response = await fetch('/api/levantamientos', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: surveyName, ciudad: surveyCity, totalEsperado: Number(surveyGoal) }) })
      const data = await response.json() as { levantamiento?: { id: string }; error?: string }
      if (!response.ok || !data.levantamiento) { setStatus(data.error ?? 'No se pudo crear el levantamiento.'); return }
      setFieldSurveyId(data.levantamiento.id)
      setFieldLabel(`Campo de ${surveyName}`)
      setSurveys(await loadSurveys())
      setStatus('Levantamiento creado y disponible para captura.')
      setSurveyName('')
    } catch { setStatus('No se pudo contactar al servidor.') } finally { setBusy(false) }
  }

  async function addField(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus('')
    const key = fieldSurveyId
    if (!key) { setStatus('Selecciona un levantamiento de tu entorno.'); setBusy(false); return }
    const field = { label: fieldLabel, tipo: fieldType, orden: 100, ...(fieldType === 'lista' ? { opciones: fieldOptions.split(',').map((value) => value.trim()).filter(Boolean) } : {}) }
    try {
      const response = await fetch(`/api/levantamientos/${encodeURIComponent(key)}/fields`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campos: [field] }) })
      const data = await response.json() as { error?: string }
      setStatus(response.ok ? 'Campo agregado al formulario del entorno.' : data.error ?? 'No se pudo agregar el campo.')
      if (response.ok) { setFieldLabel(`Campo de ${surveys.find((survey) => survey.id === key)?.nombre ?? ''}`); setFieldOptions('') }
    } catch { setStatus('No se pudo contactar al servidor.') } finally { setBusy(false) }
  }

  async function loadInvitations() {
    const response = await fetch('/api/invitations', { credentials: 'same-origin' })
    if (!response.ok) { setStatus('No se pudieron cargar las invitaciones.'); return }
    const data = await response.json() as { invitations: InvitationRow[] }
    setInvitations(data.invitations)
    setStatus(data.invitations.length ? 'Invitaciones actualizadas.' : 'Todavía no hay invitaciones en este entorno.')
  }

  async function revokeInvitation(id: string) {
    const response = await fetch('/api/invitations', { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (response.ok) await loadInvitations()
  }

  return <div className="mx-auto max-w-3xl space-y-6 p-6">
    <header className="space-y-3"><h1 className="text-2xl font-semibold">Gestión del entorno</h1><p className="text-sm text-muted-foreground">Crea levantamientos, configura sus formularios e invita a tu equipo.</p><nav aria-label="Secciones de gestión" className="flex flex-wrap gap-4 text-sm"><a className="underline" href="#surveys">Levantamientos</a>{session.data?.user?.role === 'manager' && <><a className="underline" href="#fields">Campos del formulario</a><a className="underline" href="#invitations">Invitaciones</a></>}</nav></header>
    {(busy || status) && <p role="status" aria-live="polite" className="sticky top-2 z-10 rounded-lg border bg-background p-4 text-sm">{busy ? 'Procesando…' : status}</p>}

    {session.data?.user?.role === 'admin' && <section className="rounded-lg border bg-card p-5 space-y-3"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Solicitudes de Manager</h2><Button variant="outline" onClick={() => void loadRequests()}>Cargar solicitudes</Button></div>{requests.length === 0 ? <p className="text-sm text-muted-foreground">No hay solicitudes cargadas.</p> : requests.map((row) => <article key={row._id} className="space-y-2 rounded-lg border p-4"><h3 className="font-medium">{row.nombreWorkspace} · {row.participantesEsperados} participantes</h3><p className="text-sm">{row.proposito}</p><p className="text-xs text-muted-foreground">Solicitante: {row.userId} · {row.estado}</p>{row.estado === 'pendiente' && <div className="flex gap-2"><Button onClick={() => void decide(row._id, 'aprobada')}>Aprobar</Button><Button variant="outline" onClick={() => void decide(row._id, 'rechazada')}>Rechazar</Button></div>}</article>)}</section>}
    {session.data?.user?.role === 'encuestador' && <section className="rounded-lg border bg-card p-5 space-y-4"><h2 className="text-xl font-semibold">Solicitar rol Manager</h2><form className="space-y-3" onSubmit={submitRequest}><div><Label htmlFor="workspace">Nombre del entorno</Label><Input id="workspace" required value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} /></div><div><Label htmlFor="purpose">Propósito del levantamiento</Label><Textarea id="purpose" required value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div><div><Label htmlFor="participants">Participantes estimados</Label><Input id="participants" required type="number" min="0" value={participants} onChange={(e) => setParticipants(e.target.value)} /></div><Button type="submit" disabled={busy}>Enviar solicitud</Button></form></section>}
    {session.data?.user?.role === 'manager' && <section id="invitations" className="rounded-lg border bg-card p-5 space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Invitar encuestadores</h2><Button variant="outline" onClick={() => void loadInvitations()}>Ver invitaciones</Button></div><form className="space-y-3" onSubmit={createInvite}><div><Label htmlFor="survey">Destino de la invitación</Label><select id="survey" className="h-10 w-full rounded-md border bg-background px-3" value={targetId} onChange={(e) => setTargetId(e.target.value)}><option value="">Todo el entorno</option>{surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.nombre}</option>)}</select></div><Button type="submit" disabled={busy}>Crear invitación</Button></form>{invite && <div className="space-y-2 rounded-lg border p-4"><p>Código: <strong>{invite.code}</strong></p><p className="break-all text-sm">Enlace: <a className="underline" href={invite.link}>{invite.link}</a></p></div>}{invitations.map((row) => <div key={row._id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm"><span>{row.targetType === 'workspace' ? 'Entorno' : `Levantamiento ${row.targetId}`} · vence {new Date(row.expiraEn).toLocaleDateString()} · {row.revocado ? 'revocada' : 'activa'}</span>{!row.revocado && <Button variant="outline" size="sm" onClick={() => void revokeInvitation(row._id)}>Revocar</Button>}</div>)}</section>}
    {(session.data?.user?.role === 'manager' || session.data?.user?.role === 'encuestador') && <section id="surveys" className="rounded-lg border bg-card p-5 space-y-4"><h2 className="text-xl font-semibold">{session.data.user.role === 'manager' ? 'Crear levantamiento del entorno' : 'Crear levantamiento personal'}</h2><form className="space-y-3" onSubmit={createSurvey}><div><Label htmlFor="surveyName">Nombre</Label><Input id="surveyName" required value={surveyName} onChange={(e) => setSurveyName(e.target.value)} /></div><div><Label htmlFor="surveyCity">Ciudad o zona</Label><Input id="surveyCity" required value={surveyCity} onChange={(e) => setSurveyCity(e.target.value)} /></div><div><Label htmlFor="surveyGoal">Registros esperados</Label><Input id="surveyGoal" required type="number" min="0" value={surveyGoal} onChange={(e) => setSurveyGoal(e.target.value)} /></div><Button type="submit" disabled={busy}>Crear levantamiento</Button></form><div className="space-y-2 border-t pt-3"><h3 className="text-sm font-semibold">Levantamientos disponibles ({surveys.length})</h3>{surveys.length ? <ul className="list-inside list-disc text-sm">{surveys.map((survey) => <li key={survey.id}>{survey.nombre}</li>)}</ul> : <p className="text-sm text-muted-foreground">Todavía no hay levantamientos en este entorno.</p>}</div></section>}
    {session.data?.user?.role === 'manager' && <section id="fields" className="rounded-lg border bg-card p-5 space-y-4"><h2 className="text-xl font-semibold">Agregar campo al formulario</h2><p className="text-sm text-muted-foreground">El campo queda disponible en tu entorno; los campos existentes no se pueden modificar desde aquí.</p><form className="space-y-3" onSubmit={addField}><div><Label htmlFor="fieldSurvey">Levantamiento</Label><select id="fieldSurvey" required className="h-10 w-full rounded-md border bg-background px-3" value={fieldSurveyId} onChange={(e) => { setFieldSurveyId(e.target.value); setFieldLabel(`Campo de ${surveys.find((survey) => survey.id === e.target.value)?.nombre ?? ''}`) }}><option value="">Selecciona un levantamiento</option>{surveys.map((survey) => <option key={survey.id} value={survey.id}>{survey.nombre}</option>)}</select>{surveys.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay levantamientos. Crea uno en la sección Levantamientos.</p>}<p className="text-xs text-muted-foreground">El identificador estable se genera automáticamente a partir del levantamiento. Puedes personalizar la etiqueta sugerida.</p></div><div><Label htmlFor="fieldLabel">Etiqueta</Label><Input id="fieldLabel" maxLength={120} required value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} /></div><div><Label htmlFor="fieldType">Tipo de dato</Label><select id="fieldType" className="h-10 w-full rounded-md border bg-background px-3" value={fieldType} onChange={(e) => setFieldType(e.target.value as typeof fieldType)}>{['texto', 'entero', 'decimal', 'booleano', 'lista', 'fecha'].map((type) => <option key={type} value={type}>{type === 'booleano' ? 'Verdadero/falso' : type}</option>)}</select></div>{fieldType === 'lista' && <div><Label htmlFor="fieldOptions">Opciones separadas por coma</Label><Input id="fieldOptions" required value={fieldOptions} onChange={(e) => setFieldOptions(e.target.value)} /></div>}<Button type="submit" disabled={busy}>Agregar campo</Button></form></section>}

  </div>
}
