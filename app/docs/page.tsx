import { ArrowUpRight, Code2 } from 'lucide-react'
import type { Metadata } from 'next'
import { NavBar } from '@/components/NavBar'
import { DocsExplorer } from '@/components/docs/DocsExplorer'

export const metadata: Metadata = {
  title: 'Documentación del proyecto | GeoPin',
  description: 'Arquitectura, modelo de datos, decisiones y rutas de GeoPin.',
}

export default function DocsPage() {
  return (
    <main className="industrial docs-shell">
      <NavBar />
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="docs-masthead motion-safe:animate-fade-in-up"><p className="eyebrow">GEOPIN / CENTRO DE DOCUMENTACIÓN</p><h1>Conoce el sistema.<br />Construye sobre el conocimiento.</h1><p>La guía técnica de la plataforma de Ingeniería Civil y Urbanismo. Explora su arquitectura, entiende los datos y encuentra las herramientas para trabajar con el territorio.</p><a href="https://github.com/danieljssg/geopin-v2" className="mt-5 inline-flex items-center gap-2 border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-accent"><Code2 size={17} /> Repositorio de GeoPin <ArrowUpRight size={15} /></a></header>
        <DocsExplorer />
      </div>
    </main>
  )
}
