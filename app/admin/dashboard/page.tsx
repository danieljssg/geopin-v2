import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/server/session'
import DashboardV2 from '@/components/admin/DashboardV2'

export const metadata: Metadata = {
  title: 'Dashboard del levantamiento | GeoPin',
  description: 'Avance, cobertura de servicios y mapa del levantamiento en curso.',
}

export const dynamic = 'force-dynamic'

/**
 * Dashboard del levantamiento.
 *
 * Lee del servidor, no del dispositivo: el administrador necesita el estado
 * real del operativo, no lo que tenga su navegador. Es el reemplazo v2 del
 * dashboard local de `/dashboard`, que sigue funcionando sobre el prototipo
 * hasta que el v1 se retire.
 */
export default async function AdminDashboardPage() {
  const requestHeaders = await headers()
  const user = await getSessionUser(requestHeaders)

  if (!user) redirect('/login')

  return <DashboardV2 />
}
