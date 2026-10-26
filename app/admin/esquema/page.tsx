import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSessionUser } from '@/lib/server/session'
import { hasPermission } from '@/lib/auth/roles'
import { NavBar } from '@/components/NavBar'
import SchemaBuilder from '@/components/admin/SchemaBuilder'
import { PageHeading } from '@/components/PageHeading'

export const metadata: Metadata = {
  title: 'Administrador de esquemas | GeoPin',
  description: 'Define los campos de cada módulo del formulario de levantamiento.',
}

export const dynamic = 'force-dynamic'

/**
 * Administrador de esquemas.
 *
 * Es la pantalla donde el cliente agrega un campo —"Estado de
 * Alcantarillado", por ejemplo— y aparece en la app de campo sin desplegar
 * código. Es lo que el plan pide en la Fase 3.
 */
export default async function EsquemaPage() {
  const requestHeaders = await headers()
  const user = await getSessionUser(requestHeaders)

  if (!user) redirect('/login')
  if (!hasPermission(user.role, 'esquema:editar')) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6 bg-muted">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-foreground">Sin permiso</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tu rol ({user.role}) no puede editar los esquemas. Pedile a un
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
        <PageHeading title="Esquemas de captura" description="Diseña y publica los campos que los equipos de campo completan en cada módulo." />
        <div>
          <SchemaBuilder />
        </div>
      </div>
    </main>
  )
}
