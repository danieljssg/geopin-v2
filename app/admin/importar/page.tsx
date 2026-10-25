import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getSessionUser } from '@/lib/server/session'
import { hasPermission } from '@/lib/auth/roles'
import { NavBar } from '@/components/NavBar'
import Importador from '@/components/admin/Importador'

export const metadata: Metadata = {
  title: 'Importar levantamiento | GeoPin',
  description: 'Carga archivos de campo, detecta duplicados y resuelve conflictos.',
}

export const dynamic = 'force-dynamic'

/**
 * Importación de archivos de campo.
 *
 * Es la Fase 4: los levantadores entregan Excel o CSV, y el administrador los
 * cruza contra la base sin pisar el trabajo de nadie.
 */
export default async function ImportarPage() {
  const requestHeaders = await headers()
  const user = await getSessionUser(requestHeaders)

  if (!user) redirect('/login')
  if (!hasPermission(user.role, 'importar:ejecutar')) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-muted">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-foreground">Sin permiso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu rol ({user.role}) no puede importar archivos.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-muted">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold">Importar levantamiento</h1>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Excel o CSV de campo, con cruce y detección de duplicados.
        </p>
        <div className="mt-4">
          <Importador />
        </div>
      </div>
    </main>
  )
}
