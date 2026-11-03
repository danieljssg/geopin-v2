'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useSession } from '@/lib/auth-client'

type RequestRow = { _id: string; userId: string; nombreWorkspace: string; proposito: string; participantesEsperados: number; estado: string }

export default function ManagerPortal() {
  const session = useSession()
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [workspaceName, setWorkspaceName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [participants, setParticipants] = useState('')
  const [targetId, setTargetId] = useState('')
  const [invite, setInvite] = useState<{ code: string; link: string } | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

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

  return <div className="mx-auto max-w-3xl space-y-8 p-6">
    {session.data?.user?.role === 'admin' && <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Solicitudes de Manager</h2><Button variant="outline" onClick={() => void loadRequests()}>Cargar solicitudes</Button></div>{requests.length === 0 ? <p className="text-sm text-muted-foreground">No hay solicitudes cargadas.</p> : requests.map((row) => <article key={row._id} className="space-y-2 rounded-lg border p-4"><h3 className="font-medium">{row.nombreWorkspace} · {row.participantesEsperados} participantes</h3><p className="text-sm">{row.proposito}</p><p className="text-xs text-muted-foreground">Solicitante: {row.userId} · {row.estado}</p>{row.estado === 'pendiente' && <div className="flex gap-2"><Button onClick={() => void decide(row._id, 'aprobada')}>Aprobar</Button><Button variant="outline" onClick={() => void decide(row._id, 'rechazada')}>Rechazar</Button></div>}</article>)}</section>}
    {session.data?.user?.role === 'encuestador' && <section className="space-y-4"><h2 className="text-xl font-semibold">Solicitar rol Manager</h2><form className="space-y-3" onSubmit={submitRequest}><div><Label htmlFor="workspace">Nombre del entorno</Label><Input id="workspace" required value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} /></div><div><Label htmlFor="purpose">Propósito del levantamiento</Label><Textarea id="purpose" required value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div><div><Label htmlFor="participants">Participantes estimados</Label><Input id="participants" required type="number" min="0" value={participants} onChange={(e) => setParticipants(e.target.value)} /></div><Button disabled={busy}>Enviar solicitud</Button></form></section>}
    {session.data?.user?.role === 'manager' && <section className="space-y-4"><h2 className="text-xl font-semibold">Invitar encuestadores</h2><form className="space-y-3" onSubmit={createInvite}><div><Label htmlFor="survey">ID del levantamiento (opcional; vacío invita al entorno)</Label><Input id="survey" value={targetId} onChange={(e) => setTargetId(e.target.value)} /></div><Button disabled={busy}>Crear invitación</Button></form>{invite && <div className="space-y-2 rounded-lg border p-4"><p>Código: <strong>{invite.code}</strong></p><p className="break-all text-sm">Enlace: <a className="underline" href={invite.link}>{invite.link}</a></p></div>}</section>}
    {status && <p role="status" className="text-sm">{status}</p>}
  </div>
}
