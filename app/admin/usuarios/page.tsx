import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/server/session'
import { hasPermission } from '@/lib/auth/roles'
import { NavBar } from '@/components/NavBar'
import PanelUsuarios from '@/components/admin/PanelUsuarios'
import { PageHeading } from '@/components/PageHeading'

export const metadata: Metadata = {
  title: 'Usuarios | GeoPin',
  description: 'Gestión de usuarios, roles y accesos al levantamiento.',
}

export const dynamic = 'force-dynamic'

/**
 * Panel de usuarios.
 *
 * Es la pantalla donde el administrador crea cuentas, cambia roles y
 * suspende/reactiva accesos. El gate del servidor es `usuarios:gestionar`
 * (solo admin); el panel vuelve a comprobarlo en cliente con la sesión.
 */
export default async function UsuariosPage() {
  const requestHeaders = await headers()
  const user = await getSessionUser(requestHeaders)

  if (!user) redirect('/login')
  if (!hasPermission(user.role, 'usuarios:gestionar')) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-muted">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-foreground">Sin permiso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu rol ({user.role}) no puede gestionar usuarios. Pedile a un
            administrador que te asigne el permiso.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-muted">
      <NavBar />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <PageHeading title="Usuarios" description="Administra cuentas, roles y el acceso de cada persona a la plataforma." />
        <div>
          <PanelUsuarios />
        </div>
      </div>
    </main>
  )
}
