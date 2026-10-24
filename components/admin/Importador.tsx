'use client'

import { useCallback, useRef, useState } from 'react'
import type { CampoEnConflicto } from '@/lib/domain/merge'

/**
 * Importador de archivos de campo.
 *
 * El flujo tiene dos pasos a propósito: primero se previsualiza y después
 * se aplica. **La previsualización no escribe nada.** Y al aplicar, solo se
 * crean las parcelas nuevas: las que ya existen no se sobrescriben, sus
 * diferencias quedan como conflictos para resolver campo por campo.
 */

type Accion = 'nueva' | 'actualizada' | 'duplicada' | 'error'

interface FilaAnalizada {
  fila: number
  accion: Accion
  codigo?: string
  nombre?: string
  errores: string[]
  conflictos: CampoEnConflicto[]
  parcelaExistenteId?: string
}

interface ResultadoImportacion {
  resumen: {
    filas: number
    nuevas: number
    actualizadas: number
    duplicadas: number
    conErrores: number
  }
  filas: FilaAnalizada[]
  columnasDesconocidas: string[]
  duplicados: Array<{ clave: string; ids: string[]; distanciaM: number; motivo: string }>
  avisos: string[]
  creadas: number
}

const ETIQUETAS: Record<Accion, string> = {
  nueva: 'Nueva',
  actualizada: 'Ya existe',
  duplicada: 'Duplicada',
  error: 'Error',
}

const COLORES: Record<Accion, { fondo: string; texto: string }> = {
  nueva: { fondo: '#dcfce7', texto: '#166534' },
  actualizada: { fondo: '#fef3c7', texto: '#92400e' },
  duplicada: { fondo: '#ffedd5', texto: '#9a3412' },
  error: { fondo: '#fee2e2', texto: '#b91c1c' },
}

export default function Importador() {
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aplicado, setAplicado] = useState(false)
  const [resueltos, setResueltos] = useState<Record<string, 'existente' | 'entrante'>>({})
  const [resolviendo, setResolviendo] = useState<string | null>(null)

  const archivoRef = useRef<File | null>(null)

  const enviar = useCallback(
    async (archivo: File, aplicar: boolean) => {
      setCargando(true)
      setError(null)
      setAplicado(false)

      try {
        const contenido = await leerBase64(archivo)
        const formato = archivo.name.toLowerCase().endsWith('.csv') ? 'csv' : 'xlsx'

        const respuesta = await fetch('/api/import', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formato, contenido, aplicar }),
        })

        const cuerpo = (await respuesta.json()) as ResultadoImportacion & { error?: string }

        if (!respuesta.ok) {
          setError(cuerpo.error ?? `El servidor respondió ${respuesta.status}.`)
          return
        }

        setResultado(cuerpo)
        setResueltos({})
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No se pudo procesar el archivo.')
      } finally {
        setCargando(false)
      }
    },
    [],
  )

  async function resolver(fila: FilaAnalizada) {
    if (!fila.parcelaExistenteId) return

    const conflictos = fila.conflictos
    const cambios: Record<string, unknown> = {}

    for (const conflicto of conflictos) {
      const lado = resueltos[conflicto.campo] ?? 'existente'
      if (lado === 'entrante') cambios[conflicto.campo] = conflicto.valorEntrante
    }

    setResolviendo(fila.parcelaExistenteId)

    try {
      const respuesta = await fetch(
        `/api/parcelas/${encodeURIComponent(fila.parcelaExistenteId)}/fusionar`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cambios }),
        },
      )

      if (!respuesta.ok) {
        const cuerpo = (await respuesta.json().catch(() => ({}))) as { error?: string }
        setError(cuerpo.error ?? `El servidor respondió ${respuesta.status}.`)
        return
      }

      // La fila queda resuelta: se la saca de la lista de conflictos.
      setResultado((previo) =>
        previo
          ? {
              ...previo,
              filas: previo.filas.map((f) =>
                f.fila === fila.fila ? { ...f, conflictos: [], accion: 'nueva' } : f,
              ),
            }
          : previo,
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo resolver el conflicto.')
    } finally {
      setResolviendo(null)
    }
  }

  const conflictosPendientes =
    resultado?.filas.filter((fila) => fila.accion === 'actualizada' && fila.conflictos.length > 0) ?? []

  return (
    <div className="space-y-5">
      <section className="rounded-lg bg-white p-5" style={{ border: '1px solid #e2e8f0' }}>
        <h2 className="text-base font-bold text-slate-900">Importar archivo de campo</h2>
        <p className="mt-1 text-sm text-slate-600">
          CSV o Excel. La primera vez solo se previsualiza: nada se escribe hasta que
          confirmes.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(event) => {
              const archivo = event.target.files?.[0] ?? null
              archivoRef.current = archivo
              setNombreArchivo(archivo?.name ?? '')
              setResultado(null)
              if (archivo) void enviar(archivo, false)
            }}
            className="text-sm"
          />

          {cargando && <span className="text-sm text-slate-500">Procesando…</span>}
        </div>

        {error && (
          <div className="mt-3 rounded-md px-3 py-2 text-sm" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            {error}
          </div>
        )}
      </section>

      {resultado && (
        <>
          <section className="rounded-lg bg-white p-5" style={{ border: '1px solid #e2e8f0' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {nombreArchivo || 'Archivo'} — {resultado.resumen.filas} filas
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {resultado.resumen.nuevas} nuevas · {resultado.resumen.actualizadas}{' '}
                  ya existen · {resultado.resumen.duplicadas} duplicadas ·{' '}
                  {resultado.resumen.conErrores} con error
                </p>
              </div>

              {!aplicado && resultado.resumen.nuevas > 0 && (
                <button
                  type="button"
                  disabled={cargando}
                  onClick={() => {
                    const archivo = archivoRef.current
                    if (archivo) void enviar(archivo, true).then(() => setAplicado(true))
                  }}
                  className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: '#1d4ed8' }}
                >
                  Crear {resultado.resumen.nuevas} parcelas
                </button>
              )}

              {aplicado && (
                <span
                  className="rounded-full px-3 py-1.5 text-sm font-semibold"
                  style={{ background: '#dcfce7', color: '#166534' }}
                >
                  {resultado.creadas} parcelas creadas
                </span>
              )}
            </div>

            {resultado.avisos.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-md px-3 py-2 text-sm" style={{ background: '#fef3c7', color: '#92400e' }}>
                {resultado.avisos.map((aviso, indice) => (
                  <li key={indice}>{aviso}</li>
                ))}
              </ul>
            )}

            {resultado.columnasDesconocidas.length > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                Columnas ignoradas (no se reconocen):{' '}
                {resultado.columnasDesconocidas.join(', ')}
              </p>
            )}
          </section>

          {conflictosPendientes.length > 0 && (
            <section className="rounded-lg bg-white p-5" style={{ border: '1px solid #e2e8f0' }}>
              <h2 className="text-base font-bold text-slate-900">
                Conflictos por resolver ({conflictosPendientes.length})
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Estas parcelas ya existen y el archivo trae datos distintos. Elegí qué
                valor se conserva en cada campo.
              </p>

              <div className="mt-4 space-y-4">
                {conflictosPendientes.map((fila) => (
                  <div key={fila.fila} className="rounded-md p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <p className="text-sm font-semibold text-slate-800">
                      Fila {fila.fila} — {fila.nombre ?? 'sin nombre'}{' '}
                      {fila.codigo && `(${fila.codigo})`}
                    </p>

                    <div className="mt-2 space-y-2">
                      {fila.conflictos.map((conflicto) => {
                        const eleccion = resueltos[conflicto.campo] ?? 'existente'
                        return (
                          <div key={conflicto.campo} className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-600">{conflicto.campo}</span>

                            <label className="flex items-center gap-1">
                              <input
                                type="radio"
                                name={`${fila.fila}-${conflicto.campo}`}
                                checked={eleccion === 'existente'}
                                onChange={() =>
                                  setResueltos((previo) => ({ ...previo, [conflicto.campo]: 'existente' }))
                                }
                              />
                              Actual: <strong>{formatear(conflicto.valorExistente)}</strong>
                            </label>

                            <label className="flex items-center gap-1">
                              <input
                                type="radio"
                                name={`${fila.fila}-${conflicto.campo}`}
                                checked={eleccion === 'entrante'}
                                onChange={() =>
                                  setResueltos((previo) => ({ ...previo, [conflicto.campo]: 'entrante' }))
                                }
                              />
                              Archivo: <strong>{formatear(conflicto.valorEntrante)}</strong>
                            </label>
                          </div>
                        )
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => void resolver(fila)}
                      disabled={resolviendo === fila.parcelaExistenteId}
                      className="mt-3 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                      style={{ background: '#1e3a5f' }}
                    >
                      {resolviendo === fila.parcelaExistenteId ? 'Resolviendo…' : 'Aplicar resolución'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-lg bg-white p-5" style={{ border: '1px solid #e2e8f0' }}>
            <h2 className="text-base font-bold text-slate-900">Detalle de las filas</h2>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">Fila</th>
                    <th className="py-2 pr-2">Acción</th>
                    <th className="py-2 pr-2">Nombre</th>
                    <th className="py-2 pr-2">Código</th>
                    <th className="py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.filas.map((fila) => {
                    const colores = COLORES[fila.accion]
                    return (
                      <tr key={fila.fila} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td className="py-1.5 pr-2 text-slate-400">{fila.fila}</td>
                        <td className="py-1.5 pr-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-semibold"
                            style={{ background: colores.fondo, color: colores.texto }}
                          >
                            {ETIQUETAS[fila.accion]}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-slate-700">{fila.nombre ?? '—'}</td>
                        <td className="py-1.5 pr-2 text-slate-500">{fila.codigo ?? '—'}</td>
                        <td className="py-1.5 text-xs text-slate-600">
                          {fila.errores.join(' ')}
                          {fila.conflictos.length > 0 &&
                            ` ${fila.conflictos.length} campo(s) en conflicto.`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function formatear(valor: unknown): string {
  if (valor === null || valor === undefined) return 'vacío'
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

/** Lee el archivo y lo pasa a base64. */
function leerBase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    lector.onload = () => {
      const resultado = String(lector.result ?? '')
      const coma = resultado.indexOf(',')
      resolve(coma === -1 ? resultado : resultado.slice(coma + 1))
    }
    lector.readAsDataURL(archivo)
  })
}
