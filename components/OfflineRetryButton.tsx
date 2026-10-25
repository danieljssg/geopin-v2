'use client'

import { Button } from '@/components/ui/button'

/**
 * Botón de reintento de la página offline.
 *
 * Va en su propio archivo porque la página es un Server Component y Next.js
 * no permite exportar `metadata` desde un componente de cliente.
 */
export default function OfflineRetryButton() {
  return (
    <Button type="button" onClick={() => window.location.reload()}>
      Reintentar
    </Button>
  )
}
