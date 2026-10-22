'use client'

import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields } from 'better-auth/client/plugins'
import type { AuthInstance } from '@/lib/server/auth'

/**
 * Cliente de autenticación para el navegador.
 *
 * No se fija `baseURL`: en el navegador Better Auth usa el origen actual, así
 * que la PWA de campo y el panel administrativo hablan con el mismo origen
 * sin variables de entorno extra ni configuración por entorno.
 *
 * `inferAdditionalFields` importa el tipo del campo `role` desde la
 * configuración del servidor, para que `useSession().user.role` esté tipado
 * sin duplicar la definición del rol en el cliente.
 *
 * El import del tipo es `import type`: no arrastra el módulo del servidor al
 * bundle del cliente.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<AuthInstance>()],
})

export const { signIn, signOut, signUp, useSession } = authClient
