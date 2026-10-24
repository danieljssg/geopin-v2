import type { Metadata } from 'next'
import OfflineRetryButton from '@/components/OfflineRetryButton'

export const metadata: Metadata = {
  title: 'Sin conexión',
  description: 'No hay conexión a internet y esta página no está disponible sin conexión.',
}

/**
 * Página de respaldo del service worker.
 *
 * Se muestra cuando una navegación falla y no hay nada en el cache. El
 * botón de reintento vive en un componente aparte porque esta página es un
 * Server Component: Next.js no permite exportar `metadata` desde un
 * componente marcado con `'use client'`.
 */
export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center bg-slate-50">
      <div
        aria-hidden="true"
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 30,
        }}
      >
        📡
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-slate-900">Estás sin conexión</h1>
        <p className="text-sm text-slate-600 max-w-sm">
          Esta pantalla todavía no se descargó. Los datos que ya capturaste
          están guardados en el dispositivo y se sincronizan solos cuando
          vuelva la señal.
        </p>
      </div>

      <OfflineRetryButton />

      <p className="text-xs text-slate-500">
        {/* Una recarga completa es lo que corresponde acá: es la página de
            respaldo del service worker y hay que volver a intentar la
            navegación, no hacer una transición del router. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" style={{ textDecoration: 'underline' }}>
          Volver al mapa
        </a>
      </p>
    </main>
  )
}
