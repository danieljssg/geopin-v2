import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSessionUser } from '@/lib/server/session'

/**
 * El dashboard v2 vive en `/admin/dashboard` y lee del servidor.
 *
 * El que estaba acá analizaba los pines guardados en el dispositivo, que ya
 * no se usan: el modelo v2 guarda todo en el servidor.
 */
export default async function DashboardRedirect() {
  const user = await getSessionUser(await headers())
  if (!user) redirect('/login')
  redirect(user.role === 'admin' || user.role === 'manager' ? '/admin/dashboard' : '/mi-dashboard')
}
