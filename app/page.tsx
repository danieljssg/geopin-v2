import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowUpRight, BarChart3, FileSliders, Layers3, MapPin, ShieldCheck, WifiOff } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { RedirigirSiSesion } from '@/components/auth/RedirigirSiSesion'
import { ThemeToggle } from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'GeoPin — Levantamiento GIS',
  description:
    'Registro catastral y de servicios urbanos en campo, con captura offline y sincronización.',
}

/**
 * Landing pública.
 *
 * Es la cara de la plataforma: presenta qué es GeoPin y reparte los accesos
 * por rol (campo, listado, administración). Sigue siendo estática —el shell
 * offline del service worker la precachea—, así que quien ya tiene sesión es
 * redirigido del lado del cliente (`RedirigirSiSesion`), nunca por el server.
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
      {/* Con sesión el landing no aporta nada: directo a la app. */}
      <RedirigirSiSesion destino="/listado" />
      <header className="sticky top-0 z-20 border-border/70 bg-background/85 border-b backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <MapPin className="size-4" />
            </span>
            <span className="text-base font-bold">GeoPin</span>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            {/* Enlaces de acción: buttonVariants sobre Link es el patrón
                estándar de shadcn para botones que navegan. */}
            <ThemeToggle />
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
        <section className="relative isolate overflow-hidden border-b">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.91_0.01_250/0.75),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,oklch(0.28_0.015_250/0.65),transparent_55%)]" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div className="flex max-w-2xl flex-col items-start text-left">
            <Badge variant="secondary" className="mb-6 gap-1.5 rounded-full px-3 py-1">
              <span className="size-1.5 rounded-full bg-emerald-500" /> GIS de campo · Diseñado para equipos
            </Badge>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Del territorio a decisiones <span className="text-muted-foreground">con mejores datos.</span>
            </h1>
            <p className="text-muted-foreground mt-6 max-w-xl text-base leading-7 sm:text-lg">
              GeoPin ayuda a equipos de ingeniería civil, urbanismo y arquitectura a levantar, organizar y analizar información territorial desde cualquier lugar.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/campo" className={buttonVariants({ size: 'lg' })}>
                Empezar a capturar
              </Link>
              <Link
                href="/listado"
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
                Explorar registros <ArrowUpRight className="ml-1" />
              </Link>
            </div>
            <div className="text-muted-foreground mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs"><span className="flex items-center gap-1.5"><WifiOff className="size-3.5" /> Captura sin conexión</span><span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5" /> Datos sincronizados</span></div>
          </div>
          <div className="relative mx-auto w-full max-w-xl lg:ml-auto">
            <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-muted via-background to-muted blur-2xl" />
            <div className="overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-foreground/10">
              <div className="flex items-center gap-2 border-b px-4 py-3"><span className="size-2 rounded-full bg-red-400"/><span className="size-2 rounded-full bg-amber-400"/><span className="size-2 rounded-full bg-emerald-500"/><span className="text-muted-foreground ml-2 text-xs">GeoPin · Mapa de campo</span></div>
              <div className="relative h-[300px] overflow-hidden bg-[#e9eee9] sm:h-[370px]">
                <div className="absolute inset-0 opacity-70" style={{ backgroundImage: 'linear-gradient(32deg, transparent 47%, #fff 48%, #fff 50%, transparent 51%), linear-gradient(118deg, transparent 44%, #fff 45%, #fff 47%, transparent 48%), linear-gradient(0deg, transparent 48%, #d5dfd5 49%, #d5dfd5 50%, transparent 51%)', backgroundSize: '150px 120px, 190px 150px, 90px 90px' }} />
                <div className="absolute left-[18%] top-[22%] rounded-xl border bg-background/95 p-3 shadow-lg"><p className="text-xs font-semibold">Levantamiento urbano</p><p className="text-muted-foreground mt-1 text-[10px]">Sector Centro · actualizado ahora</p></div>
                <div className="absolute left-[48%] top-[48%] flex size-12 items-center justify-center rounded-full border-4 border-white bg-slate-900 text-white shadow-xl"><MapPin className="size-5" /></div>
                <div className="absolute left-[27%] top-[57%] h-24 w-36 rotate-[-12deg] rounded-lg border-2 border-dashed border-slate-700/80 bg-slate-800/10 sm:h-28 sm:w-44" />
                <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-md"><Layers3 className="size-4"/> Predios y servicios <span className="ml-2 size-2 rounded-full bg-emerald-500"/></div>
                <div className="absolute bottom-4 right-4 rounded-lg border bg-background/95 px-3 py-2 text-xs font-medium shadow-md">Área medida <span className="ml-2 font-mono">1.284 m²</span></div>
              </div>
              <div className="grid grid-cols-3 divide-x border-t"><div className="p-3 text-center"><p className="text-lg font-semibold">GPS</p><p className="text-muted-foreground text-[10px]">precisión de campo</p></div><div className="p-3 text-center"><p className="text-lg font-semibold">Offline</p><p className="text-muted-foreground text-[10px]">listo para trabajar</p></div><div className="p-3 text-center"><p className="text-lg font-semibold">GIS</p><p className="text-muted-foreground text-[10px]">datos organizados</p></div></div>
            </div>
          </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mb-8 max-w-xl"><p className="text-muted-foreground text-xs font-semibold tracking-[0.16em] uppercase">Una plataforma de trabajo</p><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Herramientas para entender cada lugar.</h2></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CARACTERISTICAS.map(({ icono: Icono, titulo, descripcion }) => (
              <Card key={titulo} className="group rounded-xl transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
                <CardHeader className="p-5">
                  <span className="bg-muted text-foreground flex size-10 items-center justify-center rounded-xl transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icono className="size-4" />
                  </span>
                  <CardTitle className="mt-2">{titulo}</CardTitle>
                  <CardDescription>{descripcion}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Entra a tu espacio de trabajo</h2>
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
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>GeoPin · Registro territorial para equipos de campo.</span>
          <Link href="/docs" className="hover:text-foreground">Documentación del proyecto</Link>
        </div>
      </footer>
    </div>
  )
}
