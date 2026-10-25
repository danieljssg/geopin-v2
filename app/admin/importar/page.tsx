import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { buttonVariants } from '@/components/ui/button'
import { getSessionUser } from '@/lib/server/session'
import { hasPermission } from '@/lib/auth/roles'
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
      <header className="bg-primary px-4 py-4 text-primary-foreground sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold">Importar levantamiento</h1>
            <p className="text-xs text-primary-foreground/70">
              Excel o CSV de campo, con cruce y detección de duplicados.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/admin/dashboard"
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className:
                  'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground',
              })}
            >
              Dashboard
            </a>
            <a
              href="/listado"
              className={buttonVariants({
                variant: 'ghost',
                size: 'sm',
                className:
                  'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground',
              })}
            >
              Parcelas
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Importador />
      </div>
    </main>
  )
}
