'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MapPin } from 'lucide-react'

import { signOut, useSession } from '@/lib/auth-client'
import { isAdmin, ROLE_LABELS } from '@/lib/auth/roles'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Barra de navegación compartida.
 *
 * Es el único lugar que decide qué opciones ve cada rol: el menú sale de la
 * sesión (`useSession`) y de `lib/auth/roles.ts`, nunca de la página. Las
 * páginas solo la montan; agregar una opción de administración acá basta
 * para que aparezca en todos lados.
 */

const ENLACES_ENCUESTADOR = [
  { href: '/campo', label: 'Capturar' },
  { href: '/listado?mias=1', label: 'Mis registros' },
] as const

const ENLACES_ADMIN = [
  { href: '/campo', label: 'Capturar' },
  { href: '/listado', label: 'Listado' },
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/esquema', label: 'Esquemas' },
  { href: '/admin/usuarios', label: 'Usuarios' },
  { href: '/admin/levantamientos', label: 'Levantamientos' },
] as const

function inicialesDe(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '??'
  return partes
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join('')
}

export function NavBar() {
  const session = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const user = session.data?.user
  const admin = isAdmin(user?.role)

  /** La sesión se resuelve en cliente: mientras llega, la barra muestra su forma. */
  if (session.isPending) {
    return (
      <header className="border-border bg-background border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="ml-auto h-7 w-16" />
        </div>
      </header>
    )
  }

  async function cerrarSesion() {
    // Si el cierre falla no se navega: el usuario sigue con sesión y puede
    // reintentar, en vez de aterrizar en /login con la sesión viva.
    try {
      const { error } = await signOut()
      if (error) return
    } catch {
      return
    }
    router.push('/login')
    router.refresh()
  }

  const enlaces = admin ? ENLACES_ADMIN : ENLACES_ENCUESTADOR

  return (
    <header className="border-border bg-background shrink-0 border-b">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg">
            <MapPin className="size-4" />
          </span>
          <span className="text-sm font-bold">GeoPin</span>
        </Link>

        {user && (
          <nav aria-label="Principal" className="flex flex-1 items-center gap-1 overflow-x-auto">
            {enlaces.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href.split('?')[0] ? 'page' : undefined}
                className={
                  pathname === href.split('?')[0]
                    ? 'bg-accent text-accent-foreground rounded-md px-2 py-1 text-sm whitespace-nowrap'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-2 py-1 text-sm whitespace-nowrap'
                }
              >
                {label}
              </Link>
            ))}
          </nav>
        )}

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger className="hover:bg-accent flex items-center gap-2 rounded-md px-1.5 py-1 outline-none">
              <Avatar>
                <AvatarFallback>{inicialesDe(user.name ?? user.email)}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:block">{user.name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                {user.email} · {ROLE_LABELS[admin ? 'admin' : 'encuestador']}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/perfil" />}>Perfil</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={cerrarSesion}>
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link href="/login" className="text-muted-foreground hover:text-foreground text-sm">
            Entrar
          </Link>
        )}
      </div>
    </header>
  )
}
