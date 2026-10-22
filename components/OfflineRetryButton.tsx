'use client'

/**
 * Botón de reintento de la página offline.
 *
 * Va en su propio archivo porque la página es un Server Component y Next.js
 * no permite exportar `metadata` desde un componente de cliente.
 */
export default function OfflineRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="rounded-md px-5 py-2.5 text-sm font-semibold text-white"
      style={{ background: '#1e3a5f' }}
    >
      Reintentar
    </button>
  )
}
