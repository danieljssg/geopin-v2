import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
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
      <main className="min-h-screen flex items-center justify-center px-6 bg-slate-50">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-bold text-slate-900">Sin permiso</h1>
          <p className="mt-2 text-sm text-slate-600">
            Tu rol ({user.role}) no puede importar archivos.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="px-4 py-4 sm:px-6" style={{ background: '#1e3a5f' }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-white">Importar levantamiento</h1>
            <p className="text-xs" style={{ color: '#93c5fd' }}>
              Excel o CSV de campo, con cruce y detección de duplicados.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/admin/dashboard" className="text-xs text-white underline">
              Dashboard
            </a>
            <a href="/campo/lista" className="text-xs text-white underline">
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
