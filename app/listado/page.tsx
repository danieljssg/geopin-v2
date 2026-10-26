import type { Metadata } from 'next'
import ListaParcelas from '@/components/field/ListaParcelas'
import { NavBar } from '@/components/NavBar'
import { PageHeading } from '@/components/PageHeading'

export const metadata: Metadata = {
  title: 'Parcelas levantadas | GeoPin',
  description: 'Listado de las parcelas capturadas, con cambio de estado, edición y eliminación.',
}

/**
 * Listado de parcelas.
 *
 * Es la vista que le faltaba al cliente v2 para reemplazar al prototipo: ver
 * lo capturado, corregirlo y borrar lo que se capturó mal.
 */
export default function ListaPage() {
  return (
    <main className="min-h-screen bg-muted">
      <NavBar />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <PageHeading title="Parcelas levantadas" description="Revisa, filtra y administra los registros capturados en campo." />
        <div>
          <ListaParcelas />
        </div>
      </div>
    </main>
  )
}
