'use client'

import { useEffect, useRef } from 'react'

interface DrawerProps {
  open: boolean
  onClose: () => void
  height?: number | string
  children: React.ReactNode
}

export default function Drawer({ open, onClose, height = '80vh', children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const prevActive = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      const el = panelRef.current
      if (!open || !el) return
      const target = e.target as Node | null
      if (!target) return
      if (!el.contains(target)) {
        const focusable = el.querySelector<HTMLElement>(
          'button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])',
        )
        ;(focusable || el).focus()
      }
    }

    if (open) {
      prevActive.current = document.activeElement as HTMLElement
      document.addEventListener('focusin', onFocusIn)
      requestAnimationFrame(() => {
        const el = panelRef.current
        if (!el) return
        const focusable = el.querySelector<HTMLElement>(
          'button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])',
        )
        ;(focusable || el).focus()
      })
    }

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      if (prevActive.current) prevActive.current.focus()
    }
  }, [open])

  return (
    <div aria-hidden={!open} style={{ zIndex: 99999 }}>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ zIndex: 99990 }}
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`fixed left-0 right-0 mx-auto bg-white shadow-xl transition-transform duration-200 pointer-events-auto`}
        style={{
          bottom: 0,
          height,
          maxWidth: 900,
          transform: open ? 'translateY(0%)' : 'translateY(100%)',
          zIndex: 99999,
        }}
      >
        <div style={{ height: '100%', overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}
