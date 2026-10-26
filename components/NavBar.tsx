'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { MapPin, Menu, X } from 'lucide-react'
import { Drawer } from '@base-ui/react/drawer'
import { signOut, useSession } from '@/lib/auth-client'
import { isAdmin } from '@/lib/auth/roles'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/ThemeToggle'

const USER_LINKS = [{ href: '/campo', label: 'Capturar' }, { href: '/listado?mias=1', label: 'Mis registros' }, { href: '/docs', label: 'Docs' }]
const ADMIN_LINKS = [{ href: '/campo', label: 'Capturar' }, { href: '/listado', label: 'Listado' }, { href: '/admin/dashboard', label: 'Dashboard' }, { href: '/admin/esquema', label: 'Esquemas' }, { href: '/admin/usuarios', label: 'Usuarios' }, { href: '/admin/levantamientos', label: 'Levantamientos' }, { href: '/admin/importar', label: 'Importar' }, { href: '/docs', label: 'Docs' }]

export function NavBar() {
  const session = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)
  const user = session.data?.user
  const links = isAdmin(user?.role) ? ADMIN_LINKS : USER_LINKS
  async function closeSession() {
    setSigningOut(true)
    setSignOutError(false)
    try {
      const result = await signOut()
      if (result.error) { setSignOutError(true); return }
      setOpen(false)
      router.push('/login')
      router.refresh()
    } catch { setSignOutError(true) } finally { setSigningOut(false) }
  }
  if (session.isPending) return <header className="border-b bg-background p-3"><Skeleton className="h-8 w-32" /></header>
  return <header className="shrink-0 border-b bg-background">
    <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:px-6">
      <Link href="/" className="flex items-center gap-2 text-sm font-bold"><span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground"><MapPin className="size-4" /></span>GeoPin</Link>
      {user && <nav aria-label="Principal" className="hidden flex-1 items-center gap-1 overflow-x-auto lg:flex">{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href.split('?')[0] ? 'page' : undefined} className="rounded-md px-2 py-1 text-sm whitespace-nowrap hover:bg-accent aria-[current=page]:bg-accent">{link.label}</Link>)}</nav>}
      <div className="ml-auto flex items-center gap-2"><ThemeToggle />{user ? <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="down"><Drawer.Trigger render={<Button variant="outline" size="icon" aria-label="Abrir menú" className="lg:hidden"><Menu /></Button>} /><Drawer.Portal><Drawer.Backdrop className="fixed inset-0 z-[3000] bg-black/55" /><Drawer.Viewport className="fixed inset-0 z-[3001] flex items-end justify-center"><Drawer.Popup className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl lg:max-w-lg"><div className="mb-4 flex items-center justify-between"><Drawer.Title className="font-semibold">Menú</Drawer.Title><Drawer.Close render={<Button variant="ghost" size="icon" aria-label="Cerrar menú"><X /></Button>} /></div><Button variant="destructive" className="min-h-11 w-full justify-start" disabled={signingOut} onClick={closeSession}>{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</Button>{signOutError && <p role="alert" className="mt-2 text-sm text-destructive">No se pudo cerrar sesión. Inténtalo de nuevo.</p>}<Separator className="my-4" /><nav aria-label="Navegación móvil" className="flex flex-col gap-1">{[...links, { href: '/perfil', label: 'Perfil' }].map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} aria-current={pathname === link.href.split('?')[0] ? 'page' : undefined} className="flex min-h-11 items-center rounded-lg px-3 text-sm hover:bg-accent aria-[current=page]:bg-accent">{link.label}</Link>)}</nav></Drawer.Popup></Drawer.Viewport></Drawer.Portal></Drawer.Root> : <Link href="/login" className="text-sm">Entrar</Link>}</div>
    </div>
  </header>
}
