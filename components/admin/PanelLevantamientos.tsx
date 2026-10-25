'use client'

import { useEffect, useState } from 'react'

import { NavBar } from '@/components/NavBar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Panel de levantamientos.
 *
 * Lista las campañas, permite crear una nueva y editar las existentes en la
 * misma fila. El avance se lee del listado de parcelas y no del dashboard: el
 * dashboard trae hasta 5.000 documentos para calcular agregados que acá no se
 * usan, mientras que el listado resuelve el conteo con un `countDocuments`.
 * Una petición de conteo por campaña, en paralelo; si alguna falla se muestra
 * "—" y la edición sigue disponible, porque el avance es contexto y no un
 * requisito para gestionar la campaña.
 */

interface LevantamientoResumen {
  id: string
  nombre: string
  ciudad: string
  totalEsperado: number
  creadoEn: string
}

interface Mensaje {
  tipo: 'ok' | 'error'
  texto: string
}

/** Valores del formulario, siempre como texto: el input manda strings. */
interface Borrador {
  nombre: string
  ciudad: string
  totalEsperado: string
}

const BORRADOR_VACIO: Borrador = { nombre: '', ciudad: '', totalEsperado: '' }

const FORMATO_FECHA = new Intl.DateTimeFormat('es-VE', { dateStyle: 'medium' })

function fechaCorta(iso: string): string {
  const fecha = new Date(iso)
  return Number.isNaN(fecha.getTime()) ? '—' : FORMATO_FECHA.format(fecha)
}

/**
 * Valida el borrador con las mismas reglas que el POST: nombre y ciudad no
 * vacíos, total esperado entero no negativo. El texto vacío se descarta antes
 * de convertirlo, porque `Number('')` es 0 y crearía una campaña con total 0
 * sin que nadie lo haya pedido.
 */
function validarBorrador(
  borrador: Borrador,
): { ok: true; nombre: string; ciudad: string; totalEsperado: number } | { ok: false; error: string } {
  const nombre = borrador.nombre.trim()
  if (nombre === '') return { ok: false, error: 'Falta el nombre del levantamiento.' }

  const ciudad = borrador.ciudad.trim()
  if (ciudad === '') return { ok: false, error: 'Falta la ciudad del levantamiento.' }

  const totalTexto = borrador.totalEsperado.trim()
  const totalEsperado = Number(totalTexto)
  if (totalTexto === '' || !Number.isInteger(totalEsperado) || totalEsperado < 0) {
    return { ok: false, error: 'El total esperado debe ser un entero no negativo.' }
  }

  return { ok: true, nombre, ciudad, totalEsperado }
}

async function pedirLevantamientos(): Promise<{
  levantamientos?: LevantamientoResumen[]
  error?: string
}> {
  try {
    const respuesta = await fetch('/api/levantamientos', { credentials: 'same-origin' })
    if (!respuesta.ok) return { error: `El servidor respondió ${respuesta.status}.` }

    const { levantamientos } = (await respuesta.json()) as {
      levantamientos: LevantamientoResumen[]
    }
    return { levantamientos }
  } catch (caught) {
    return {
      error: caught instanceof Error ? caught.message : 'No se pudieron cargar los levantamientos.',
    }
  }
}

async function pedirProgreso(
  levantamientos: LevantamientoResumen[],
): Promise<Record<string, number>> {
  const pares = await Promise.all(
    levantamientos.map(async (levantamiento) => {
      try {
        const url = `/api/parcelas?levantamientoId=${encodeURIComponent(levantamiento.id)}&limite=1`
        const respuesta = await fetch(url, { credentials: 'same-origin' })
        if (!respuesta.ok) return null

        const { total } = (await respuesta.json()) as { total: number }
        return [levantamiento.id, total] as const
      } catch {
        return null
      }
    }),
  )

  const progreso: Record<string, number> = {}
  for (const par of pares) {
    if (par) progreso[par[0]] = par[1]
  }
  return progreso
}

export default function PanelLevantamientos() {
  const [levantamientos, setLevantamientos] = useState<LevantamientoResumen[] | null>(null)
  const [progreso, setProgreso] = useState<Record<string, number>>({})
  const [cargando, setCargando] = useState(true)
  const [recarga, setRecarga] = useState(0)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)

  const [alta, setAlta] = useState<Borrador>(BORRADOR_VACIO)
  const [creando, setCreando] = useState(false)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [borradorEdicion, setBorradorEdicion] = useState<Borrador>(BORRADOR_VACIO)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true

    async function cargar() {
      const resultado = await pedirLevantamientos()
      if (!vivo) return

      if (!resultado.levantamientos) {
        setMensaje({
          tipo: 'error',
          texto: resultado.error ?? 'No se pudieron cargar los levantamientos.',
        })
        setCargando(false)
        return
      }

      setLevantamientos(resultado.levantamientos)
      setCargando(false)

      // El avance llega después: la lista ya es usable mientras tanto.
      const conteos = await pedirProgreso(resultado.levantamientos)
      if (vivo) setProgreso(conteos)
    }

    void cargar()
    return () => {
      vivo = false
    }
  }, [recarga])

  function reintentar() {
    setMensaje(null)
    setCargando(true)
    setRecarga((valor) => valor + 1)
  }

  function actualizarAlta(campo: keyof Borrador, valor: string) {
    setAlta((previo) => ({ ...previo, [campo]: valor }))
  }

  function actualizarEdicion(campo: keyof Borrador, valor: string) {
    setBorradorEdicion((previo) => ({ ...previo, [campo]: valor }))
  }

  async function onCrear(event: React.FormEvent) {
    event.preventDefault()

    const validado = validarBorrador(alta)
    if (!validado.ok) {
      setMensaje({ tipo: 'error', texto: validado.error })
      return
    }

    setCreando(true)
    setMensaje(null)

    try {
      const respuesta = await fetch('/api/levantamientos', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: validado.nombre,
          ciudad: validado.ciudad,
          totalEsperado: validado.totalEsperado,
        }),
      })

      const cuerpo = (await respuesta.json()) as {
        levantamiento?: LevantamientoResumen
        error?: string
      }

      if (!respuesta.ok || !cuerpo.levantamiento) {
        setMensaje({
          tipo: 'error',
          texto: cuerpo.error ?? `El servidor respondió ${respuesta.status}.`,
        })
        return
      }

      const creado = cuerpo.levantamiento
      // El listado llega ordenado por fecha de creación descendente.
      setLevantamientos((previos) => [creado, ...(previos ?? [])])
      setProgreso((previos) => ({ ...previos, [creado.id]: 0 }))
      setAlta(BORRADOR_VACIO)
      setMensaje({ tipo: 'ok', texto: `Levantamiento «${creado.nombre}» creado.` })
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' })
    } finally {
      setCreando(false)
    }
  }

  function empezarEdicion(levantamiento: LevantamientoResumen) {
    setEditandoId(levantamiento.id)
    setBorradorEdicion({
      nombre: levantamiento.nombre,
      ciudad: levantamiento.ciudad,
      totalEsperado: String(levantamiento.totalEsperado),
    })
    setMensaje(null)
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setBorradorEdicion(BORRADOR_VACIO)
  }

  async function onGuardar(id: string) {
    const validado = validarBorrador(borradorEdicion)
    if (!validado.ok) {
      setMensaje({ tipo: 'error', texto: validado.error })
      return
    }

    setGuardandoId(id)
    setMensaje(null)

    try {
      const respuesta = await fetch(`/api/levantamientos/${id}`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: validado.nombre,
          ciudad: validado.ciudad,
          totalEsperado: validado.totalEsperado,
        }),
      })

      const cuerpo = (await respuesta.json()) as {
        levantamiento?: LevantamientoResumen
        error?: string
      }

      if (!respuesta.ok || !cuerpo.levantamiento) {
        setMensaje({
          tipo: 'error',
          texto: cuerpo.error ?? `El servidor respondió ${respuesta.status}.`,
        })
        return
      }

      const actualizado = cuerpo.levantamiento
      setLevantamientos((previos) =>
        (previos ?? []).map((item) => (item.id === actualizado.id ? actualizado : item)),
      )
      cancelarEdicion()
      setMensaje({ tipo: 'ok', texto: `Levantamiento «${actualizado.nombre}» actualizado.` })
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' })
    } finally {
      setGuardandoId(null)
    }
  }

  return (
    <main className="min-h-screen bg-muted">
      <NavBar />

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Levantamientos</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Campañas activas, su total esperado y cuántas parcelas llevan capturadas.
          </p>
        </div>

        {mensaje && (
          <Alert
            role={mensaje.tipo === 'ok' ? 'status' : 'alert'}
            variant={mensaje.tipo === 'ok' ? 'default' : 'destructive'}
          >
            <AlertDescription>
              <p>{mensaje.texto}</p>
              {mensaje.tipo === 'error' && levantamientos === null && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={reintentar}
                >
                  Reintentar
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Nuevo levantamiento</CardTitle>
            <CardDescription>
              El total esperado es contra lo que el dashboard mide el avance del operativo.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form className="space-y-3" onSubmit={onCrear}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="alta-nombre">Nombre</Label>
                  <Input
                    id="alta-nombre"
                    value={alta.nombre}
                    onChange={(event) => actualizarAlta('nombre', event.target.value)}
                    placeholder="Casco histórico"
                    disabled={creando}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="alta-ciudad">Ciudad</Label>
                  <Input
                    id="alta-ciudad"
                    value={alta.ciudad}
                    onChange={(event) => actualizarAlta('ciudad', event.target.value)}
                    placeholder="Valencia"
                    disabled={creando}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="alta-total">Total esperado</Label>
                  <Input
                    id="alta-total"
                    type="number"
                    min={0}
                    step={1}
                    value={alta.totalEsperado}
                    onChange={(event) => actualizarAlta('totalEsperado', event.target.value)}
                    placeholder="283"
                    disabled={creando}
                  />
                </div>
              </div>

              <Button type="submit" disabled={creando}>
                {creando ? 'Creando…' : 'Crear levantamiento'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Campañas</CardTitle>
            <CardDescription>
              {levantamientos === null
                ? 'Cargando…'
                : `${levantamientos.length} ${levantamientos.length === 1 ? 'levantamiento' : 'levantamientos'}`}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {cargando && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-2/3" />
              </div>
            )}

            {!cargando && levantamientos?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Todavía no hay levantamientos. Creá el primero en el formulario de arriba.
              </p>
            )}

            {!cargando && levantamientos && levantamientos.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-1.5 pr-2">Levantamiento</th>
                    <th className="py-1.5 pr-2">Total esperado</th>
                    <th className="py-1.5 pr-2">Capturadas</th>
                    <th className="py-1.5 pr-2">Creado</th>
                    <th className="py-1.5 text-right">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {levantamientos.map((levantamiento) => {
                    const enEdicion = editandoId === levantamiento.id
                    const guardando = guardandoId === levantamiento.id
                    const capturadas = progreso[levantamiento.id]
                    const porcentaje =
                      capturadas !== undefined && levantamiento.totalEsperado > 0
                        ? Math.min(
                            100,
                            Math.round((capturadas / levantamiento.totalEsperado) * 100),
                          )
                        : null

                    return (
                      <tr key={levantamiento.id} className="border-t align-middle">
                        <td className="py-2 pr-2">
                          {enEdicion ? (
                            <div className="space-y-1.5">
                              <Input
                                aria-label="Nombre del levantamiento"
                                value={borradorEdicion.nombre}
                                onChange={(event) => actualizarEdicion('nombre', event.target.value)}
                                disabled={guardando}
                                autoFocus
                              />
                              <Input
                                aria-label="Ciudad del levantamiento"
                                value={borradorEdicion.ciudad}
                                onChange={(event) => actualizarEdicion('ciudad', event.target.value)}
                                disabled={guardando}
                              />
                            </div>
                          ) : (
                            <>
                              <p className="font-medium">{levantamiento.nombre}</p>
                              <p className="text-xs text-muted-foreground">
                                {levantamiento.ciudad}
                              </p>
                            </>
                          )}
                        </td>

                        <td className="py-2 pr-2">
                          {enEdicion ? (
                            <Input
                              aria-label="Total esperado"
                              type="number"
                              min={0}
                              step={1}
                              value={borradorEdicion.totalEsperado}
                              onChange={(event) =>
                                actualizarEdicion('totalEsperado', event.target.value)
                              }
                              disabled={guardando}
                            />
                          ) : (
                            levantamiento.totalEsperado.toLocaleString('es-VE')
                          )}
                        </td>

                        <td className="py-2 pr-2">
                          {capturadas === undefined ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{capturadas}</span>
                              {porcentaje !== null && (
                                <Badge variant={porcentaje >= 100 ? 'default' : 'outline'}>
                                  {porcentaje} %
                                </Badge>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-2 pr-2 text-muted-foreground">
                          {fechaCorta(levantamiento.creadoEn)}
                        </td>

                        <td className="py-2 text-right">
                          {enEdicion ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void onGuardar(levantamiento.id)}
                                disabled={guardando}
                              >
                                {guardando ? 'Guardando…' : 'Guardar'}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={cancelarEdicion}
                                disabled={guardando}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => empezarEdicion(levantamiento)}
                            >
                              Editar
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
