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
    <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div
        aria-hidden="true"
        className="bg-muted flex size-16 items-center justify-center rounded-full text-3xl"
      >
        📡
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground">Estás sin conexión</h1>
        <p className="text-muted-foreground max-w-sm text-sm">
          Esta pantalla todavía no se descargó. Los datos que ya capturaste
          están guardados en el dispositivo y se sincronizan solos cuando
          vuelva la señal.
        </p>
      </div>

      <OfflineRetryButton />

      <p className="text-muted-foreground text-xs">
        {/* Una recarga completa es lo que corresponde acá: es la página de
            respaldo del service worker y hay que volver a intentar la
            navegación, no hacer una transición del router. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/campo" className="underline">
          Volver al mapa
        </a>
      </p>
    </main>
  )
}
