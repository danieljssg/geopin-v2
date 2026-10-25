'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ParcelaEstado } from '@/lib/domain/types'

/**
 * Lista de parcelas levantadas.
 *
 * Es la vista que le falta a la app v2 para reemplazar al prototipo: el
 * levantador tiene que ver lo que ya capturó, corregirlo y borrar lo que
 * se capturó mal.
 *
 * Editar y borrar van contra el servidor. Los cambios de una sesión sin
 * conexión pasan por la cola, igual que la captura.
 */

interface ParcelaFila {
  id: string
  nombre: string
  codigo?: string
  categoria: string
  estado: ParcelaEstado
  lat: number
  lng: number
  areaM2?: number
  creadoEn: string
  actualizadoEn: string
}

/**
 * Pide la lista al servidor.
 *
 * Vive fuera del componente a propósito: así el efecto solo aplica el
 * resultado y no hay un `setState` en su cuerpo.
 */
async function pedirParcelas(): Promise<{ parcelas?: ParcelaFila[]; error?: string }> {
  try {
    const respuesta = await fetch('/api/parcelas?limite=200', { credentials: 'same-origin' })
    if (!respuesta.ok) return { error: `El servidor respondió ${respuesta.status}.` }

    const cuerpo = (await respuesta.json()) as { parcelas?: ParcelaFila[] }
    return { parcelas: cuerpo.parcelas ?? [] }
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : 'No se pudo cargar la lista.' }
  }
}

const ETIQUETAS: Record<ParcelaEstado, string> = {
  completa: 'Completada',
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
}

const VARIANTE_ESTADO: Record<ParcelaEstado, 'secondary' | 'outline' | 'default'> = {
  completa: 'secondary',
  pendiente: 'outline',
  en_revision: 'default',
}

const FILTROS: Record<string, string> = {
  '': 'Todos los estados',
  completa: 'Completadas',
  pendiente: 'Pendientes',
  en_revision: 'En revisión',
}

export default function ListaParcelas() {
  const [parcelas, setParcelas] = useState<ParcelaFila[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // El estado de carga se deriva de los datos: si todavía no hay lista, la
  // primera carga sigue en curso. Guardarlo en estado obligaba a un setState
  // dentro del efecto, que React 19 marca porque provoca un render en cascada.
  const cargando = parcelas === null && error === null
  const [filtro, setFiltro] = useState<ParcelaEstado | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [eliminando, setEliminando] = useState<string | null>(null)

  const [recarga, setRecarga] = useState(0)

  /**
   * La carga inicial aplica el resultado en un `.then()`, no dentro del
   * cuerpo del efecto: un setState síncrono ahí provoca un render en
   * cascada, que es lo que marca React 19.
   */
  useEffect(() => {
    let vivo = true

    void pedirParcelas().then((resultado) => {
      if (!vivo) return
      if (resultado.parcelas) setParcelas(resultado.parcelas)
      if (resultado.error) setError(resultado.error)
    })

    return () => {
      vivo = false
    }
  }, [recarga])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return (parcelas ?? []).filter((parcela) => {
      if (filtro && parcela.estado !== filtro) return false
      if (texto === '') return true
      return (
        parcela.nombre.toLowerCase().includes(texto) ||
        (parcela.codigo ?? '').toLowerCase().includes(texto)
      )
    })
  }, [parcelas, filtro, busqueda])

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar esta parcela? La acción no se puede deshacer.')) return

    setEliminando(id)
    try {
      const respuesta = await fetch(`/api/parcelas/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!respuesta.ok) {
        const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string }
        throw new Error(cuerpo.error ?? `El servidor respondió ${respuesta.status}.`)
      }
      setParcelas((previas) => (previas ?? []).filter((parcela) => parcela.id !== id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar.')
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por nombre o código"
          aria-label="Buscar parcelas"
          className="w-full sm:w-60"
        />

        <Select
          value={filtro}
          onValueChange={(value) => setFiltro((value ?? '') as ParcelaEstado | '')}
        >
          <SelectTrigger aria-label="Filtrar por estado" className="w-full sm:w-44">
            <SelectValue>{(value) => FILTROS[value as string] ?? FILTROS['']}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FILTROS).map(([value, etiqueta]) => (
              <SelectItem key={value} value={value}>
                {etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-xs text-muted-foreground">
          {visibles.length} de {parcelas?.length ?? 0}
        </span>

        <div className="ml-auto flex gap-2">
          {(['geojson', 'csv', 'xlsx', 'shp'] as const).map((formato) => (
            <a
              key={formato}
              href={`/api/export?format=${formato}`}
              className={buttonVariants({ variant: 'outline', size: 'xs' })}
            >
              {formato === 'shp' ? 'SHP' : formato.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            <p>{error}</p>
            <Button
              type="button"
              variant="link"
              size="xs"
              className="mt-1"
              onClick={() => {
                setError(null)
                setRecarga((valor) => valor + 1)
              }}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {cargando && <p className="text-sm text-muted-foreground">Cargando parcelas…</p>}

      {!cargando && !error && visibles.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {(parcelas?.length ?? 0) === 0
            ? 'Todavía no hay parcelas levantadas.'
            : 'Ninguna parcela coincide con el filtro.'}
        </p>
      )}

      {!cargando && visibles.length > 0 && (
        <Card size="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs tracking-wide uppercase text-muted-foreground">
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Área</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibles.map((parcela) => (
                  <tr key={parcela.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{parcela.nombre}</td>
                    <td className="px-3 py-2 text-muted-foreground">{parcela.codigo ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={VARIANTE_ESTADO[parcela.estado]}>
                        {ETIQUETAS[parcela.estado]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      {parcela.areaM2 !== undefined
                        ? `${parcela.areaM2.toLocaleString('es-VE')} m²`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(parcela.creadoEn).toLocaleDateString('es-VE')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <Link
                          href={`/campo?parcela=${encodeURIComponent(parcela.id)}`}
                          className={buttonVariants({ variant: 'outline', size: 'xs' })}
                        >
                          Editar
                        </Link>
                        <Button
                          type="button"
                          variant="destructive"
                          size="xs"
                          onClick={() => void eliminar(parcela.id)}
                          disabled={eliminando === parcela.id}
                        >
                          {eliminando === parcela.id ? '…' : 'Eliminar'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
