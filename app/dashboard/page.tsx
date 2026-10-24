import { redirect } from 'next/navigation'

/**
 * El dashboard v2 vive en `/admin/dashboard` y lee del servidor.
 *
 * El que estaba acá analizaba los pines guardados en el dispositivo, que ya
 * no se usan: el modelo v2 guarda todo en el servidor.
 */
export default function DashboardRedirect() {
  redirect('/admin/dashboard')
}
