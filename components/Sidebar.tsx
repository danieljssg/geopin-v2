'use client'

import { useEffect, useRef } from 'react'

interface SidebarProps {
  open: boolean
  onClose: () => void
  width?: number
  children: React.ReactNode
}

export default function Sidebar({ open, onClose, width = 360, children }: SidebarProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const prevActive = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function onFocusIn(e: FocusEvent) {
      const el = panelRef.current
      if (!open || !el) return
      const target = e.target as Node | null
      if (!target) return
      if (!el.contains(target)) {
        // If focus tries to leave the panel, bring it back to first focusable inside
        const focusable = el.querySelector<HTMLElement>(
          'button, a, input, textarea, select, [tabindex]:not([tabindex="-1"])',
        )
        ;(focusable || el).focus()
      }
    }

    if (open) {
      prevActive.current = document.activeElement as HTMLElement

      // trap focus inside the panel
      document.addEventListener('focusin', onFocusIn)

      // focus panel or first focusable
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
  }, [open, onClose])

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 pointer-events-none ${open ? '' : 'opacity-0'} `}
      style={{ zIndex: 99999 }}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`}
        style={{ zIndex: 99990 }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`fixed top-0 right-0 h-full bg-white shadow-xl transition-transform duration-200 pointer-events-auto focus:outline-none`}
        style={{ width, transform: open ? 'translateX(0%)' : 'translateX(100%)', zIndex: 99999 }}
      >
        <div style={{ height: '100%', overflow: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}
