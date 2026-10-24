'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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

const ETIQUETAS: Record<ParcelaEstado, string> = {
  completa: 'Completada',
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
}

const COLORES: Record<ParcelaEstado, { fondo: string; texto: string }> = {
  completa: { fondo: '#dcfce7', texto: '#166534' },
  pendiente: { fondo: '#fef3c7', texto: '#92400e' },
  en_revision: { fondo: '#dbeafe', texto: '#1e40af' },
}

export default function ListaParcelas() {
  const [parcelas, setParcelas] = useState<ParcelaFila[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<ParcelaEstado | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [eliminando, setEliminando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)

    try {
      const respuesta = await fetch('/api/parcelas?limite=200', { credentials: 'same-origin' })
      if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`)

      const cuerpo = (await respuesta.json()) as { parcelas: ParcelaFila[] }
      setParcelas(cuerpo.parcelas ?? [])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo cargar la lista.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()

    return parcelas.filter((parcela) => {
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
      setParcelas((previas) => previas.filter((parcela) => parcela.id !== id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar.')
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por nombre o código"
          aria-label="Buscar parcelas"
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: '#cbd5e1', minWidth: 240 }}
        />

        <select
          value={filtro}
          onChange={(event) => setFiltro(event.target.value as ParcelaEstado | '')}
          aria-label="Filtrar por estado"
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: '#cbd5e1' }}
        >
          <option value="">Todos los estados</option>
          <option value="completa">Completadas</option>
          <option value="pendiente">Pendientes</option>
          <option value="en_revision">En revisión</option>
        </select>

        <span className="text-xs text-slate-500">
          {visibles.length} de {parcelas.length}
        </span>

        <div className="ml-auto flex gap-2">
          {(['geojson', 'csv', 'xlsx', 'shp'] as const).map((formato) => (
            <a
              key={formato}
              href={`/api/export?format=${formato}`}
              className="rounded-md px-3 py-1.5 text-xs font-semibold"
              style={{ background: '#e2e8f0', color: '#334155' }}
            >
              {formato === 'shp' ? 'SHP' : formato.toUpperCase()}
            </a>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md px-3 py-2 text-sm" style={{ background: '#fee2e2', color: '#b91c1c' }}>
          <p>{error}</p>
          <button type="button" onClick={() => void cargar()} className="mt-1 font-semibold underline">
            Reintentar
          </button>
        </div>
      )}

      {cargando && <p className="text-sm text-slate-500">Cargando parcelas…</p>}

      {!cargando && !error && visibles.length === 0 && (
        <p className="text-sm text-slate-500">
          {parcelas.length === 0
            ? 'Todavía no hay parcelas levantadas.'
            : 'Ninguna parcela coincide con el filtro.'}
        </p>
      )}

      {!cargando && visibles.length > 0 && (
        <div className="overflow-x-auto rounded-lg bg-white" style={{ border: '1px solid #e2e8f0' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Área</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((parcela) => {
                const colores = COLORES[parcela.estado]
                return (
                  <tr key={parcela.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td className="px-3 py-2 text-slate-800">{parcela.nombre}</td>
                    <td className="px-3 py-2 text-slate-500">{parcela.codigo ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: colores.fondo, color: colores.texto }}
                      >
                        {ETIQUETAS[parcela.estado]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {parcela.areaM2 !== undefined
                        ? `${parcela.areaM2.toLocaleString('es-VE')} m²`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-500">
                      {new Date(parcela.creadoEn).toLocaleDateString('es-VE')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Link
                          href={`/?parcela=${encodeURIComponent(parcela.id)}`}
                          className="rounded px-2 py-1 text-xs font-semibold"
                          style={{ background: '#dbeafe', color: '#1d4ed8' }}
                        >
                          Editar
                        </Link>
                        <button
                          type="button"
                          onClick={() => void eliminar(parcela.id)}
                          disabled={eliminando === parcela.id}
                          className="rounded px-2 py-1 text-xs font-semibold disabled:opacity-40"
                          style={{ background: '#fee2e2', color: '#b91c1c' }}
                        >
                          {eliminando === parcela.id ? '…' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
