import type { Metadata } from 'next'
import ListaParcelas from '@/components/field/ListaParcelas'
import { NavBar } from '@/components/NavBar'

export const metadata: Metadata = {
  title: 'Parcelas levantadas | GeoPin',
  description: 'Listado de las parcelas capturadas, con edición y eliminación.',
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
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <h1 className="text-lg font-semibold">Parcelas levantadas</h1>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Editá o eliminá lo que ya capturaste.
        </p>
        <div className="mt-4">
          <ListaParcelas />
        </div>
      </div>
    </main>
  )
}
