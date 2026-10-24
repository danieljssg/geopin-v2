import { redirect } from 'next/navigation'

/** El listado vive en `/listado`. */
export default function ListaRedirect() {
  redirect('/listado')
}
