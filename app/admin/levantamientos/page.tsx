import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/server/session'
import { hasPermission } from '@/lib/auth/roles'
import PanelLevantamientos from '@/components/admin/PanelLevantamientos'

export const metadata: Metadata = {
  title: 'Levantamientos | GeoPin',
  description: 'Campañas de levantamiento: alta, edición y avance de captura.',
}

export const dynamic = 'force-dynamic'

/**
 * Panel de levantamientos.
 *
 * Es la pantalla donde se define la campaña —nombre, ciudad y cuántas
 * parcelas se esperan— y contra la que el dashboard mide el "163 de 283".
 * La gestión es administrativa: el encuestador solo captura parcelas.
 */
export default async function LevantamientosPage() {
  const requestHeaders = await headers()
  const user = await getSessionUser(requestHeaders)

  if (!user) redirect('/login')
  if (!hasPermission(user.role, 'levantamiento:gestionar')) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-muted">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-foreground">Sin permiso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu rol ({user.role}) no puede gestionar los levantamientos. Pedile a
            un administrador que te asigne el permiso.
          </p>
        </div>
      </main>
    )
  }

  return <PanelLevantamientos />
}
