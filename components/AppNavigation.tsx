import Link from 'next/link'

interface AppNavigationProps {
  active: 'map' | 'dashboard'
}

const links = [
  { href: '/', label: 'Mapa', key: 'map' },
  { href: '/dashboard', label: 'Dashboard', key: 'dashboard' },
] as const

export default function AppNavigation({ active }: AppNavigationProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="ml-auto flex items-center rounded-lg bg-slate-950/30 p-1"
    >
      {links.map((link) => {
        const isCurrent = active === link.key
        return (
          <Link
            key={link.key}
            href={link.href}
            aria-current={isCurrent ? 'page' : undefined}
            className={`inline-flex min-h-9 items-center justify-center rounded-md px-2.5 text-xs font-semibold transition-colors sm:px-3 ${
              isCurrent
                ? 'bg-white text-[#1e3a5f]'
                : 'text-blue-100 hover:bg-white/10 hover:text-white'
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e3a5f]`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
