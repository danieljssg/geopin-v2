'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

import { useSession } from '@/lib/auth-client'
import { isAdmin } from '@/lib/auth/roles'

/**
 * Manda a los usuarios con sesión fuera de las páginas de invitado.
 *
 * La landing y el login son estáticas a propósito: el service worker las
 * precachea como shell offline, así que no hay guard de servidor — el
 * redirect ocurre del lado del cliente cuando la sesión se resuelve. Sin
 * sesión la página queda como está: el landing es público y el login es el
 * lugar natural de un invitado.
 *
 * `destino` es el destino de cualquier rol; `destinoAdmin` lo overridea.
 */
export function RedirigirSiSesion({
  destino,
  destinoAdmin,
}: {
  destino: string
  destinoAdmin?: string
}) {
  const session = useSession()
  const router = useRouter()

  useEffect(() => {
    if (session.isPending) return
    const user = session.data?.user
    if (!user) return
    router.replace(isAdmin(user.role) && destinoAdmin ? destinoAdmin : destino)
  }, [session.isPending, session.data?.user, destino, destinoAdmin, router])

  return null
}
