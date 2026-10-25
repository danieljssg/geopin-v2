import type { Metadata } from 'next'
import Link from 'next/link'
import { BarChart3, FileSliders, MapPin, WifiOff } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export const metadata: Metadata = {
  title: 'GeoPin — Levantamiento GIS',
  description:
    'Registro catastral y de servicios urbanos en campo, con captura offline y sincronización.',
}

/**
 * Landing pública.
 *
 * Es la cara de la plataforma: presenta qué es GeoPin y reparte los accesos
 * por rol (campo, listado, administración). No hay lógica de sesión acá:
 * cada app interna decide su propia autorización al entrar.
 */

const CARACTERISTICAS = [
  {
    icono: MapPin,
    titulo: 'Captura guiada en campo',
    descripcion:
      'Marcar establecimientos, viviendas y edificaciones sobre el mapa con GPS del dispositivo, filtrando lecturas por precisión.',
  },
  {
    icono: FileSliders,
    titulo: 'Esquemas sin desplegar código',
    descripcion:
      'Los formularios salen de esquemas publicados por administración: los campos nuevos aparecen en la app de campo al instante.',
  },
  {
    icono: WifiOff,
    titulo: 'Offline primero',
    descripcion:
      'Mapas descargados y captura guardada en el dispositivo; todo se sincroniza solo cuando vuelve la señal.',
  },
  {
    icono: BarChart3,
    titulo: 'Panel de administración',
    descripcion:
      'Dashboard de avance, importación de Excel o CSV con detección de duplicados y exportación de lo levantado.',
  },
] as const

const ACCESOS = [
  {
    href: '/campo',
    titulo: 'App de campo',
    descripcion: 'Capturar y editar parcelas sobre el mapa.',
  },
  {
    href: '/listado',
    titulo: 'Parcelas levantadas',
    descripcion: 'Revisar, corregir o eliminar lo capturado.',
  },
  {
    href: '/admin/dashboard',
    titulo: 'Dashboard',
    descripcion: 'Avance del levantamiento por zona y módulo.',
  },
  {
    href: '/admin/importar',
    titulo: 'Importar',
    descripcion: 'Cargar Excel o CSV con cruces y duplicados.',
  },
  {
    href: '/admin/esquema',
    titulo: 'Esquemas',
    descripcion: 'Definir los formularios que usa el campo.',
  },
  {
    href: '/login',
    titulo: 'Entrar',
    descripcion: 'Iniciar sesión con tu cuenta de GeoPin.',
  },
] as const

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <MapPin className="size-4" />
            </span>
            <span className="text-base font-bold">GeoPin</span>
          </div>
          <nav className="flex items-center gap-2">
            {/* Enlaces de acción: buttonVariants sobre Link es el patrón
                estándar de shadcn para botones que navegan. */}
            <Link href="/login" className={buttonVariants({ variant: 'ghost' })}>
              Entrar
            </Link>
            <Link href="/campo" className={buttonVariants()}>
              Abrir la app
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <Badge variant="secondary" className="mb-4">
              Captura offline · Sincronización automática
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Levantamiento catastral en campo, sin perder un dato
            </h1>
            <p className="text-muted-foreground mt-4 text-base sm:text-lg">
              GeoPin registra establecimientos, viviendas y servicios urbanos
              sobre el mapa, con o sin conexión, y sincroniza la captura del
              equipo cuando vuelve la señal.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link href="/campo" className={buttonVariants({ size: 'lg' })}>
                Empezar a capturar
              </Link>
              <Link
                href="/listado"
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
                Ver parcelas levantadas
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {CARACTERISTICAS.map(({ icono: Icono, titulo, descripcion }) => (
              <Card key={titulo}>
                <CardHeader>
                  <span className="bg-muted text-foreground flex size-9 items-center justify-center rounded-lg">
                    <Icono className="size-4" />
                  </span>
                  <CardTitle className="mt-2">{titulo}</CardTitle>
                  <CardDescription>{descripcion}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Accesos rápidos</h2>
            <Separator className="flex-1" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ACCESOS.map(({ href, titulo, descripcion }) => (
              <Link key={href} href={href} className="group">
                <Card className="group-hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-base">{titulo}</CardTitle>
                    <CardDescription>{descripcion}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-border border-t">
        <div className="text-muted-foreground mx-auto max-w-5xl px-4 py-6 text-xs sm:px-6">
          GeoPin · Registro catastral y de servicios urbanos en campo.
        </div>
      </footer>
    </div>
  )
}
