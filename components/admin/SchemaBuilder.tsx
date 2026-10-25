'use client'

import { useEffect, useMemo, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { FieldDef, FieldType, ModuleSchema, ModuloId } from '@/lib/domain/types'
import {
  MODULOS,
  addField,
  moveField,
  removeField,
  schemasDiffer,
  slugifyFieldKey,
  updateField,
  validateSchemaFields,
} from '@/lib/domain/schema-builder'

/**
 * Administrador de esquemas.
 *
 * Edita la lista de campos de un módulo y la publica de una vez. La clave de
 * cada campo se genera de la etiqueta la primera vez y después no cambia:
 * renombrar la etiqueta no puede mover los datos ya capturados.
 */

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  texto: 'Texto libre',
  entero: 'Entero',
  decimal: 'Decimal',
  booleano: 'Sí / No',
  lista: 'Lista desplegable',
  fecha: 'Fecha',
}

const TIPOS: FieldType[] = ['texto', 'entero', 'decimal', 'booleano', 'lista', 'fecha']

interface Borrador {
  moduleId: string
  modulo: ModuloId
  campos: FieldDef[]
  versionActual: number
}

export default function SchemaBuilder() {
  const [moduloActivo, setModuloActivo] = useState<ModuloId>('edificacion')
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({})
  const [publicados, setPublicados] = useState<Record<string, FieldDef[]>>({})
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [nuevo, setNuevo] = useState<{ label: string; tipo: FieldType; opciones: string }>({
    label: '',
    tipo: 'texto',
    opciones: '',
  })

  useEffect(() => {
    let vivo = true

    async function cargar() {
      try {
        const respuesta = await fetch('/api/esquemas', { credentials: 'same-origin' })
        if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`)

        const { esquemas } = (await respuesta.json()) as { esquemas: ModuleSchema[] }
        if (!vivo) return

        const siguiente: Record<string, Borrador> = {}
        const publicadosIniciales: Record<string, FieldDef[]> = {}

        for (const esquema of esquemas) {
          siguiente[esquema.moduleId] = {
            moduleId: esquema.moduleId,
            modulo: esquema.modulo,
            campos: [...esquema.campos].sort((a, b) => a.orden - b.orden),
            versionActual: esquema.version,
          }
          publicadosIniciales[esquema.moduleId] = [...esquema.campos].sort((a, b) => a.orden - b.orden)
        }

        setBorradores(siguiente)
        setPublicados(publicadosIniciales)
      } catch (error) {
        if (vivo) {
          setMensaje({
            tipo: 'error',
            texto: error instanceof Error ? error.message : 'No se pudieron cargar los esquemas.',
          })
        }
      } finally {
        if (vivo) setCargando(false)
      }
    }

    void cargar()
    return () => {
      vivo = false
    }
  }, [])

  const borrador = borradores[moduloActivo]
  const errores = useMemo(
    () => (borrador ? validateSchemaFields(borrador.campos) : []),
    [borrador],
  )
  const hayCambios = borrador
    ? schemasDiffer(publicados[moduloActivo] ?? [], borrador.campos)
    : false

  function actualizarCampos(campos: FieldDef[]) {
    setBorradores((previo) => ({
      ...previo,
      [moduloActivo]: { ...previo[moduloActivo], campos },
    }))
    setMensaje(null)
  }

  function onAgregar(event: React.FormEvent) {
    event.preventDefault()
    if (!borrador || nuevo.label.trim() === '') return

    const key = slugifyFieldKey(nuevo.label)
    const opciones =
      nuevo.tipo === 'lista'
        ? nuevo.opciones
            .split('\n')
            .map((opcion) => opcion.trim())
            .filter(Boolean)
        : undefined

    actualizarCampos(
      addField(borrador.campos, {
        key,
        label: nuevo.label.trim(),
        tipo: nuevo.tipo,
        opciones,
        requerido: false,
      }),
    )

    setNuevo({ label: '', tipo: 'texto', opciones: '' })
  }

  async function onGuardar() {
    if (!borrador || errores.length > 0) return

    setGuardando(true)
    setMensaje(null)

    try {
      const respuesta = await fetch(`/api/esquemas/${moduloActivo}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campos: borrador.campos }),
      })

      const cuerpo = (await respuesta.json()) as { esquema?: ModuleSchema; error?: string }

      if (!respuesta.ok || !cuerpo.esquema) {
        setMensaje({ tipo: 'error', texto: cuerpo.error ?? `El servidor respondió ${respuesta.status}.` })
        return
      }

      setBorradores((previo) => ({
        ...previo,
        [moduloActivo]: {
          ...previo[moduloActivo],
          campos: cuerpo.esquema!.campos,
          versionActual: cuerpo.esquema!.version,
        },
      }))
      setPublicados((previo) => ({ ...previo, [moduloActivo]: cuerpo.esquema!.campos }))
      setMensaje({ tipo: 'ok', texto: `Publicado. Versión ${cuerpo.esquema.version}.` })
    } catch {
      setMensaje({ tipo: 'error', texto: 'No se pudo contactar al servidor.' })
    } finally {
      setGuardando(false)
    }
  }

  function onDescartar() {
    if (!borrador) return
    setBorradores((previo) => ({
      ...previo,
      [moduloActivo]: { ...previo[moduloActivo], campos: [...(publicados[moduloActivo] ?? [])] },
    }))
    setMensaje(null)
  }

  return (
    <Tabs value={moduloActivo} onValueChange={(valor) => setModuloActivo(valor as ModuloId)}>
      <TabsList variant="line" aria-label="Módulos">
        {MODULOS.map((modulo) => {
          const borradorModulo = borradores[modulo.id]
          const sucio = borradorModulo
            ? schemasDiffer(publicados[modulo.id] ?? [], borradorModulo.campos)
            : false

          return (
            <TabsTrigger key={modulo.id} value={modulo.id}>
              {modulo.label}
              {sucio && <span aria-label="cambios sin guardar"> •</span>}
            </TabsTrigger>
          )
        })}
      </TabsList>

      <TabsContent value={moduloActivo}>
        <Card>
          <CardContent>
            {cargando && (
              <div className="space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-2/3" />
              </div>
            )}

            {!cargando && borrador && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Versión publicada: {borrador.versionActual} · {borrador.campos.length} campos
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onDescartar}
                      disabled={!hayCambios || guardando}
                    >
                      Descartar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={onGuardar}
                      disabled={!hayCambios || guardando || errores.length > 0}
                    >
                      {guardando ? 'Publicando…' : 'Publicar cambios'}
                    </Button>
                  </div>
                </div>

                {mensaje && (
                  <Alert
                    role="status"
                    variant={mensaje.tipo === 'ok' ? 'default' : 'destructive'}
                    className="mt-3"
                  >
                    <AlertDescription>{mensaje.texto}</AlertDescription>
                  </Alert>
                )}

                {errores.length > 0 && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription>
                      <ul className="space-y-1">
                        {errores.map((error, indice) => (
                          <li key={`${error.campo}-${indice}`}>{error.message}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 pr-2">Etiqueta</th>
                        <th className="py-2 pr-2">Clave</th>
                        <th className="py-2 pr-2">Tipo</th>
                        <th className="py-2 pr-2">Obligatorio</th>
                        <th className="py-2 pr-2">Orden</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {borrador.campos.map((campo, indice) => (
                        <tr key={campo.key} className="border-t">
                          <td className="py-2 pr-2 text-muted-foreground">{indice + 1}</td>
                          <td className="py-2 pr-2">
                            <Input
                              aria-label={`Etiqueta de ${campo.key}`}
                              value={campo.label}
                              onChange={(event) =>
                                actualizarCampos(
                                  updateField(borrador.campos, campo.key, { label: event.target.value }),
                                )
                              }
                              className="w-full min-w-40"
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <code className="text-xs text-muted-foreground">{campo.key}</code>
                          </td>
                          <td className="py-2 pr-2">
                            <Select
                              value={campo.tipo}
                              onValueChange={(valor) => {
                                const tipo = valor as FieldType
                                actualizarCampos(
                                  updateField(borrador.campos, campo.key, {
                                    tipo,
                                    opciones: tipo === 'lista' ? (campo.opciones ?? ['Opción 1']) : undefined,
                                  }),
                                )
                              }}
                            >
                              <SelectTrigger aria-label={`Tipo de ${campo.key}`}>
                                <SelectValue>
                                  {(valor) => FIELD_TYPE_LABELS[valor as FieldType]}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {TIPOS.map((tipo) => (
                                  <SelectItem key={tipo} value={tipo}>
                                    {FIELD_TYPE_LABELS[tipo]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-2 pr-2">
                            <input
                              type="checkbox"
                              aria-label={`Obligatorio ${campo.key}`}
                              checked={campo.requerido ?? false}
                              onChange={(event) =>
                                actualizarCampos(
                                  updateField(borrador.campos, campo.key, { requerido: event.target.checked }),
                                )
                              }
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                aria-label={`Subir ${campo.key}`}
                                onClick={() => actualizarCampos(moveField(borrador.campos, campo.key, -1))}
                                disabled={indice === 0}
                              >
                                ↑
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon-xs"
                                aria-label={`Bajar ${campo.key}`}
                                onClick={() => actualizarCampos(moveField(borrador.campos, campo.key, 1))}
                                disabled={indice === borrador.campos.length - 1}
                              >
                                ↓
                              </Button>
                            </div>
                          </td>
                          <td className="py-2">
                            <Button
                              type="button"
                              variant="destructive"
                              size="xs"
                              aria-label={`Borrar ${campo.key}`}
                              onClick={() => actualizarCampos(removeField(borrador.campos, campo.key))}
                            >
                              Borrar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {borrador.campos
                    .filter((campo) => campo.tipo === 'lista')
                    .map((campo) => (
                      <div key={`opciones-${campo.key}`} className="mt-3">
                        <Label htmlFor={`opciones-${campo.key}`} className="mb-1">
                          Opciones de {campo.label} (una por línea)
                        </Label>
                        <Textarea
                          id={`opciones-${campo.key}`}
                          rows={Math.min(8, Math.max(3, (campo.opciones ?? []).length))}
                          value={(campo.opciones ?? []).join('\n')}
                          onChange={(event) =>
                            actualizarCampos(
                              updateField(borrador.campos, campo.key, {
                                opciones: event.target.value
                                  .split('\n')
                                  .map((o) => o.trim())
                                  .filter(Boolean),
                              }),
                            )
                          }
                          className="font-mono text-xs"
                        />
                      </div>
                    ))}
                </div>

                <Separator className="my-6" />

                <form onSubmit={onAgregar} className="space-y-3">
                  <h2 className="text-sm font-bold">Agregar campo</h2>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="nuevo-label" className="mb-1">
                        Etiqueta
                      </Label>
                      <Input
                        id="nuevo-label"
                        value={nuevo.label}
                        onChange={(event) =>
                          setNuevo((previo) => ({ ...previo, label: event.target.value }))
                        }
                        placeholder="Estado de alcantarillado"
                      />
                      {nuevo.label.trim() !== '' && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Clave: <code>{slugifyFieldKey(nuevo.label)}</code>
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="nuevo-tipo" className="mb-1">
                        Tipo
                      </Label>
                      <Select
                        id="nuevo-tipo"
                        value={nuevo.tipo}
                        onValueChange={(valor) =>
                          setNuevo((previo) => ({ ...previo, tipo: valor as FieldType }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(valor) => FIELD_TYPE_LABELS[valor as FieldType]}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {TIPOS.map((tipo) => (
                            <SelectItem key={tipo} value={tipo}>
                              {FIELD_TYPE_LABELS[tipo]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {nuevo.tipo === 'lista' && (
                    <div>
                      <Label htmlFor="nuevo-opciones" className="mb-1">
                        Opciones (una por línea)
                      </Label>
                      <Textarea
                        id="nuevo-opciones"
                        rows={4}
                        value={nuevo.opciones}
                        onChange={(event) =>
                          setNuevo((previo) => ({ ...previo, opciones: event.target.value }))
                        }
                        placeholder={'Conectado\nNo conectado\nParcial'}
                        className="font-mono text-xs"
                      />
                    </div>
                  )}

                  <Button type="submit" disabled={nuevo.label.trim() === ''}>
                    Agregar
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
