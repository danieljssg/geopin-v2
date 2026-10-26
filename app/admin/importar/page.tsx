import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { getSessionUser } from '@/lib/server/session'
import { hasPermission } from '@/lib/auth/roles'
import { NavBar } from '@/components/NavBar'
import Importador from '@/components/admin/Importador'
import { PageHeading } from '@/components/PageHeading'

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
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <PageHeading title="Importar levantamiento" description="Carga archivos Excel o CSV, revisa coincidencias y resuelve duplicados antes de incorporar registros." />
        <div>
          <Importador />
        </div>
      </div>
    </main>
  )
}
