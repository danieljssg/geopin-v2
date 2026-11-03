'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark'

function readTheme(): Theme {
  return window.localStorage.getItem('geopin-theme') === 'dark' ? 'dark' : 'light'
}

function subscribeTheme(callback: () => void) {
  window.addEventListener('geopin-theme-change', callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener('geopin-theme-change', callback)
    window.removeEventListener('storage', callback)
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'light')

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    window.localStorage.setItem('geopin-theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    window.dispatchEvent(new CustomEvent('geopin-theme-change', { detail: next }))
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Activar modo claro' : 'Activar modo oscuro'}
      title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
