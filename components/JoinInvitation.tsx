'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function JoinInvitation() {
  const session = useSession()
  const params = useSearchParams()
  const [code, setCode] = useState(() => params.get('invite') ?? '')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function join(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    const isLink = code.length > 20
    try {
      const response = await fetch('/api/invitations/accept', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(isLink ? { invite: code } : { code }) })
      const data = await response.json() as { error?: string }
      setMessage(response.ok ? 'Te uniste al entorno correctamente. Ya puedes volver a GeoPin.' : data.error ?? 'No se pudo aceptar la invitación.')
    } catch { setMessage('No se pudo contactar al servidor.') } finally { setBusy(false) }
  }

  if (!session.data?.user) return <p className="rounded-lg border p-4">Inicia sesión o crea una cuenta para aceptar. <Link className="underline" href={`/login${code ? `?invite=${encodeURIComponent(code)}` : ''}`}>Ir a iniciar sesión</Link></p>
  return <form onSubmit={join} className="mx-auto max-w-lg space-y-4 p-6"><h1 className="text-2xl font-semibold">Unirse a un levantamiento</h1><label htmlFor="invitation" className="text-sm">Código o token de invitación</label><Input id="invitation" required value={code} onChange={(e) => setCode(e.target.value)} /><Button disabled={busy}>{busy ? 'Validando…' : 'Unirme'}</Button>{message && <p role="status">{message}</p>}</form>
}
