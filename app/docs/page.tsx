import type { Metadata } from 'next'
import { NavBar } from '@/components/NavBar'
import { PageHeading } from '@/components/PageHeading'
import { DocsExplorer } from '@/components/docs/DocsExplorer'

export const metadata: Metadata = {
  title: 'Documentación del proyecto | GeoPin',
  description: 'Arquitectura, modelo de datos, decisiones y rutas de GeoPin.',
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-muted/40">
      <NavBar />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <PageHeading title="Documentación del proyecto" description="Una guía práctica para entender GeoPin, cómo se guardan los datos y dónde vive cada capacidad." />
        <DocsExplorer />
      </div>
    </main>
  )
}
