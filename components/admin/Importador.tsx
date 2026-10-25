'use client'

import { useCallback, useRef, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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

const VARIANTE_ACCION: Record<Accion, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  nueva: 'default',
  actualizada: 'secondary',
  duplicada: 'outline',
  error: 'destructive',
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
      <Card>
        <CardHeader>
          <CardTitle>Importar archivo de campo</CardTitle>
          <CardDescription>
            CSV o Excel. La primera vez solo se previsualiza: nada se escribe hasta que
            confirmes.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(event) => {
                const archivo = event.target.files?.[0] ?? null
                archivoRef.current = archivo
                setNombreArchivo(archivo?.name ?? '')
                setResultado(null)
                if (archivo) void enviar(archivo, false)
              }}
            />

            {cargando && <span className="text-sm text-muted-foreground">Procesando…</span>}
          </div>

          {error && (
            <Alert variant="destructive" className="mt-3">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {resultado && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>
                {nombreArchivo || 'Archivo'} — {resultado.resumen.filas} filas
              </CardTitle>
              <CardDescription>
                {resultado.resumen.nuevas} nuevas · {resultado.resumen.actualizadas}{' '}
                ya existen · {resultado.resumen.duplicadas} duplicadas ·{' '}
                {resultado.resumen.conErrores} con error
              </CardDescription>

              {!aplicado && resultado.resumen.nuevas > 0 && (
                <CardAction>
                  <Button
                    type="button"
                    disabled={cargando}
                    onClick={() => {
                      const archivo = archivoRef.current
                      if (archivo) void enviar(archivo, true).then(() => setAplicado(true))
                    }}
                  >
                    Crear {resultado.resumen.nuevas} parcelas
                  </Button>
                </CardAction>
              )}

              {aplicado && (
                <CardAction>
                  <Badge>{resultado.creadas} parcelas creadas</Badge>
                </CardAction>
              )}
            </CardHeader>

            <CardContent>
              {resultado.avisos.length > 0 && (
                <Alert>
                  <AlertDescription>
                    <ul className="space-y-1">
                      {resultado.avisos.map((aviso, indice) => (
                        <li key={indice}>{aviso}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {resultado.columnasDesconocidas.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Columnas ignoradas (no se reconocen):{' '}
                  {resultado.columnasDesconocidas.join(', ')}
                </p>
              )}
            </CardContent>
          </Card>

          {conflictosPendientes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Conflictos por resolver ({conflictosPendientes.length})</CardTitle>
                <CardDescription>
                  Estas parcelas ya existen y el archivo trae datos distintos. Elegí qué
                  valor se conserva en cada campo.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {conflictosPendientes.map((fila) => (
                  <Card key={fila.fila} size="sm">
                    <CardContent>
                      <p className="text-sm font-semibold">
                        Fila {fila.fila} — {fila.nombre ?? 'sin nombre'}{' '}
                        {fila.codigo && `(${fila.codigo})`}
                      </p>

                      <div className="mt-2 space-y-2">
                        {fila.conflictos.map((conflicto) => {
                          const eleccion = resueltos[conflicto.campo] ?? 'existente'
                          return (
                            <div key={conflicto.campo} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-semibold text-muted-foreground">{conflicto.campo}</span>

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

                      <Button
                        type="button"
                        size="sm"
                        className="mt-3"
                        onClick={() => void resolver(fila)}
                        disabled={resolviendo === fila.parcelaExistenteId}
                      >
                        {resolviendo === fila.parcelaExistenteId ? 'Resolviendo…' : 'Aplicar resolución'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Detalle de las filas</CardTitle>
            </CardHeader>

            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2">Fila</th>
                    <th className="py-2 pr-2">Acción</th>
                    <th className="py-2 pr-2">Nombre</th>
                    <th className="py-2 pr-2">Código</th>
                    <th className="py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.filas.map((fila) => (
                    <tr key={fila.fila} className="border-t">
                      <td className="py-1.5 pr-2 text-muted-foreground">{fila.fila}</td>
                      <td className="py-1.5 pr-2">
                        <Badge variant={VARIANTE_ACCION[fila.accion]}>
                          {ETIQUETAS[fila.accion]}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-2">{fila.nombre ?? '—'}</td>
                      <td className="py-1.5 pr-2 text-muted-foreground">{fila.codigo ?? '—'}</td>
                      <td className="py-1.5 text-xs text-muted-foreground">
                        {fila.errores.join(' ')}
                        {fila.conflictos.length > 0 &&
                          ` ${fila.conflictos.length} campo(s) en conflicto.`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
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
