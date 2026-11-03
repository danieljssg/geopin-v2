import { NavBar } from '@/components/NavBar'
import JoinInvitation from '@/components/JoinInvitation'
import { Suspense } from 'react'

export default function JoinPage() {
  return <main className="min-h-screen bg-muted"><NavBar /><Suspense fallback={<p className="p-6">Cargando…</p>}><JoinInvitation /></Suspense></main>
}
