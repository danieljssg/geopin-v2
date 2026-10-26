'use client'

import type { ReactNode } from 'react'

/** Encabezado común para páginas de trabajo: jerarquía y espaciado coherentes. */
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 border-b border-border/70 pb-5 sm:mb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
