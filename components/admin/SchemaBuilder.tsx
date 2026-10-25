'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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

export default function SchemaBuilder({ usuario }: { usuario: string }) {
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
    <main className="min-h-screen bg-slate-50">
      <header className="px-4 py-4 sm:px-6" style={{ background: '#1e3a5f' }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-white">Administrador de esquemas</h1>
            <p className="text-xs" style={{ color: '#93c5fd' }}>
              Los campos que agregues acá aparecen en la app de campo sin desplegar código.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: '#93c5fd' }}>
              {usuario}
            </span>
            <Link href="/campo" className="text-xs text-white underline">
              Ir al mapa
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <nav className="flex flex-wrap gap-1" aria-label="Módulos">
          {MODULOS.map((modulo) => {
            const activo = modulo.id === moduloActivo
            const borradorModulo = borradores[modulo.id]
            const sucio = borradorModulo
              ? schemasDiffer(publicados[modulo.id] ?? [], borradorModulo.campos)
              : false

            return (
              <button
                key={modulo.id}
                type="button"
                onClick={() => setModuloActivo(modulo.id)}
                aria-current={activo ? 'page' : undefined}
                className="rounded-t-md px-4 py-2 text-sm font-semibold"
                style={{
                  background: activo ? '#ffffff' : '#e2e8f0',
                  color: activo ? '#1e3a5f' : '#475569',
                  borderBottom: activo ? '2px solid #1d4ed8' : '2px solid transparent',
                }}
              >
                {modulo.label}
                {sucio && <span aria-label="cambios sin guardar"> •</span>}
              </button>
            )
          })}
        </nav>

        <section className="rounded-b-lg rounded-tr-lg bg-white p-5" style={{ border: '1px solid #e2e8f0' }}>
          {cargando && <p className="text-sm text-slate-500">Cargando esquemas…</p>}

          {!cargando && borrador && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Versión publicada: {borrador.versionActual} · {borrador.campos.length} campos
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onDescartar}
                    disabled={!hayCambios || guardando}
                    className="rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-40"
                    style={{ background: '#f1f5f9', color: '#334155' }}
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={onGuardar}
                    disabled={!hayCambios || guardando || errores.length > 0}
                    className="rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                    style={{ background: '#1e3a5f' }}
                  >
                    {guardando ? 'Publicando…' : 'Publicar cambios'}
                  </button>
                </div>
              </div>

              {mensaje && (
                <p
                  role="status"
                  className="mt-3 rounded-md px-3 py-2 text-sm"
                  style={
                    mensaje.tipo === 'ok'
                      ? { background: '#dcfce7', color: '#166534' }
                      : { background: '#fee2e2', color: '#b91c1c' }
                  }
                >
                  {mensaje.texto}
                </p>
              )}

              {errores.length > 0 && (
                <ul role="alert" className="mt-3 space-y-1 rounded-md px-3 py-2 text-sm" style={{ background: '#fef3c7', color: '#92400e' }}>
                  {errores.map((error, indice) => (
                    <li key={`${error.campo}-${indice}`}>{error.message}</li>
                  ))}
                </ul>
              )}

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
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
                      <tr key={campo.key} style={{ borderTop: '1px solid #f1f5f9' }}>
                        <td className="py-2 pr-2 text-slate-400">{indice + 1}</td>
                        <td className="py-2 pr-2">
                          <input
                            aria-label={`Etiqueta de ${campo.key}`}
                            value={campo.label}
                            onChange={(event) =>
                              actualizarCampos(updateField(borrador.campos, campo.key, { label: event.target.value }))
                            }
                            className="w-full min-w-40 rounded border px-2 py-1"
                            style={{ borderColor: '#cbd5e1' }}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <code className="text-xs text-slate-500">{campo.key}</code>
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            aria-label={`Tipo de ${campo.key}`}
                            value={campo.tipo}
                            onChange={(event) => {
                              const tipo = event.target.value as FieldType
                              actualizarCampos(
                                updateField(borrador.campos, campo.key, {
                                  tipo,
                                  opciones: tipo === 'lista' ? (campo.opciones ?? ['Opción 1']) : undefined,
                                }),
                              )
                            }}
                            className="rounded border px-2 py-1"
                            style={{ borderColor: '#cbd5e1' }}
                          >
                            {TIPOS.map((tipo) => (
                              <option key={tipo} value={tipo}>
                                {FIELD_TYPE_LABELS[tipo]}
                              </option>
                            ))}
                          </select>
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
                            <button
                              type="button"
                              aria-label={`Subir ${campo.key}`}
                              onClick={() => actualizarCampos(moveField(borrador.campos, campo.key, -1))}
                              disabled={indice === 0}
                              className="rounded px-2 py-1 disabled:opacity-30"
                              style={{ background: '#f1f5f9' }}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              aria-label={`Bajar ${campo.key}`}
                              onClick={() => actualizarCampos(moveField(borrador.campos, campo.key, 1))}
                              disabled={indice === borrador.campos.length - 1}
                              className="rounded px-2 py-1 disabled:opacity-30"
                              style={{ background: '#f1f5f9' }}
                            >
                              ↓
                            </button>
                          </div>
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            aria-label={`Borrar ${campo.key}`}
                            onClick={() => actualizarCampos(removeField(borrador.campos, campo.key))}
                            className="rounded px-2 py-1 text-xs font-medium"
                            style={{ background: '#fee2e2', color: '#b91c1c' }}
                          >
                            Borrar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {borrador.campos
                  .filter((campo) => campo.tipo === 'lista')
                  .map((campo) => (
                    <div key={`opciones-${campo.key}`} className="mt-3">
                      <label
                        htmlFor={`opciones-${campo.key}`}
                        className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1"
                      >
                        Opciones de {campo.label} (una por línea)
                      </label>
                      <textarea
                        id={`opciones-${campo.key}`}
                        rows={Math.min(8, Math.max(3, (campo.opciones ?? []).length))}
                        value={(campo.opciones ?? []).join('\n')}
                        onChange={(event) =>
                          actualizarCampos(
                            updateField(borrador.campos, campo.key, {
                              opciones: event.target.value.split('\n').map((o) => o.trim()).filter(Boolean),
                            }),
                          )
                        }
                        className="w-full rounded border px-2 py-1 font-mono text-xs"
                        style={{ borderColor: '#cbd5e1' }}
                      />
                    </div>
                  ))}
              </div>

              <form onSubmit={onAgregar} className="mt-6 rounded-md p-4" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <h2 className="text-sm font-bold text-slate-700">Agregar campo</h2>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="nuevo-label" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Etiqueta
                    </label>
                    <input
                      id="nuevo-label"
                      value={nuevo.label}
                      onChange={(event) => setNuevo((previo) => ({ ...previo, label: event.target.value }))}
                      placeholder="Estado de alcantarillado"
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: '#cbd5e1' }}
                    />
                    {nuevo.label.trim() !== '' && (
                      <p className="mt-1 text-xs text-slate-400">
                        Clave: <code>{slugifyFieldKey(nuevo.label)}</code>
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="nuevo-tipo" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Tipo
                    </label>
                    <select
                      id="nuevo-tipo"
                      value={nuevo.tipo}
                      onChange={(event) => setNuevo((previo) => ({ ...previo, tipo: event.target.value as FieldType }))}
                      className="w-full rounded-md border px-3 py-2 text-sm"
                      style={{ borderColor: '#cbd5e1' }}
                    >
                      {TIPOS.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {FIELD_TYPE_LABELS[tipo]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {nuevo.tipo === 'lista' && (
                  <div className="mt-3">
                    <label htmlFor="nuevo-opciones" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Opciones (una por línea)
                    </label>
                    <textarea
                      id="nuevo-opciones"
                      rows={4}
                      value={nuevo.opciones}
                      onChange={(event) => setNuevo((previo) => ({ ...previo, opciones: event.target.value }))}
                      placeholder={'Conectado\nNo conectado\nParcial'}
                      className="w-full rounded-md border px-3 py-2 font-mono text-xs"
                      style={{ borderColor: '#cbd5e1' }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={nuevo.label.trim() === ''}
                  className="mt-3 rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: '#1d4ed8' }}
                >
                  Agregar
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
