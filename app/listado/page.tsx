import type { Metadata } from 'next'
import ListaParcelas from '@/components/field/ListaParcelas'

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
      <header className="bg-primary px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-primary-foreground">Parcelas levantadas</h1>
            <p className="text-primary-foreground/70 text-xs">
              Editá o eliminá lo que ya capturaste.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a href="/campo" className="text-primary-foreground/90 text-xs underline">
              Capturar
            </a>
            <a href="/admin/dashboard" className="text-primary-foreground/90 text-xs underline">
              Dashboard
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <ListaParcelas />
      </div>
    </main>
  )
}
