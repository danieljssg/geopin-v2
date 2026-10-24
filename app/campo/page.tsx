import { redirect } from 'next/navigation'

/**
 * La app de campo vive en la raíz.
 *
 * Se deja la redirección para que los enlaces y marcadores anteriores sigan
 * funcionando.
 */
export default function CampoRedirect() {
  redirect('/')
}
