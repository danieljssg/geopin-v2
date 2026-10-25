import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/server/session'
import { hasPermission } from '@/lib/auth/roles'
import { NavBar } from '@/components/NavBar'
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
 *
 * El gate es `levantamiento:gestionar` (solo admin): el dashboard expone el
 * estado completo del operativo y no debe quedar al alcance de un encuestador.
 */
export default async function AdminDashboardPage() {
  const requestHeaders = await headers()
  const user = await getSessionUser(requestHeaders)

  if (!user) redirect('/login')
  if (!hasPermission(user.role, 'levantamiento:gestionar')) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-muted">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-foreground">Sin permiso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu rol ({user.role}) no puede ver el dashboard del levantamiento.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-muted">
      <NavBar />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold">Dashboard del levantamiento</h1>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Avance, cobertura de servicios y mapa del levantamiento en curso.
        </p>
        <div className="mt-4">
          <DashboardV2 />
        </div>
      </div>
    </main>
  )
}
