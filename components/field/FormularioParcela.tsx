'use client'

import { useMemo, useState } from 'react'
import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import { validateModuleData } from '@/lib/domain/schema'
import type { FieldDef, FieldError, GeoPolygon, ModuleSchema } from '@/lib/domain/types'

/**
 * Formulario de parcela renderizado desde el esquema publicado.
 *
 * No hay campos hardcodeados: lo que el administrador publique es lo que se
 * dibuja. Cada módulo es una pestaña, así que una visita registra
 * edificación, infraestructura y equipamiento sin cambiar de pantalla.
 *
 * Regla de validación: **un módulo se valida solo si tiene algún dato**. Un
 * levantador que no sabe de electricidad no puede quedar bloqueado por un
 * campo obligatorio de un módulo que ni tocó; pero si empezó a llenarlo, se
 * le exige terminarlo.
 */

export interface FormularioParcelaProps {
  esquemas: ModuleSchema[]
  /** Id de la parcela. Si no viene, se genera uno nuevo al guardar. */
  id?: string
  ubicacion: { lat: number; lng: number }
  gps: { fuente: 'sensor' | 'manual'; precision?: number }
  /** Versión que el servidor tiene de cada módulo. `0` para una parcela nueva. */
  versiones?: Record<string, number>
  /** Polígono ya cerrado, si el levantador lo trazó. */
  geometria?: GeoPolygon | null
  /** Área efectiva: la del polígono o la escrita a mano. */
  areaM2?: number
  perimetroM?: number
  onGuardar: (payload: ParcelaCreateRequest) => Promise<void>
}

type Valores = Record<string, Record<string, unknown>>

export default function FormularioParcela({
  esquemas,
  id,
  ubicacion,
  gps,
  versiones = {},
  geometria,
  areaM2,
  perimetroM,
  onGuardar,
}: FormularioParcelaProps) {
  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('Vivienda')
  const [descripcion, setDescripcion] = useState('')
  const [valores, setValores] = useState<Valores>({})
  const [errores, setErrores] = useState<FieldError[]>([])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const ordenados = useMemo(
    () => [...esquemas].sort((a, b) => a.moduleId.localeCompare(b.moduleId)),
    [esquemas],
  )
  const [moduloActivo, setModuloActivo] = useState<string>(ordenados[0]?.moduleId ?? '')

  const modulo = ordenados.find((esquema) => esquema.moduleId === moduloActivo) ?? ordenados[0]

  function setValor(moduleId: string, key: string, valor: unknown) {
    setValores((previo) => ({
      ...previo,
      [moduleId]: { ...(previo[moduleId] ?? {}), [key]: valor },
    }))
    setMensaje(null)
  }

  function tieneDatos(datos: Record<string, unknown> | undefined): boolean {
    if (!datos) return false
    return Object.values(datos).some(
      (valor) => valor !== undefined && valor !== null && String(valor).trim() !== '',
    )
  }

  function moduloConErrores(esquema: ModuleSchema): FieldError[] {
    const datos = valores[esquema.moduleId]
    if (!tieneDatos(datos)) return []
    return validateModuleData(esquema.campos, datos ?? {})
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setMensaje(null)

    const todosLosErrores = ordenados.flatMap((esquema) => moduloConErrores(esquema))
    if (todosLosErrores.length > 0) {
      setErrores(todosLosErrores)
      const primerModulo = ordenados.find((esquema) => moduloConErrores(esquema).length > 0)
      if (primerModulo) setModuloActivo(primerModulo.moduleId)
      setMensaje('Revisá los campos marcados.')
      return
    }

    setErrores([])
    setGuardando(true)

    try {
      const modulos = ordenados
        .filter((esquema) => tieneDatos(valores[esquema.moduleId]))
        .map((esquema) => ({
          moduleId: esquema.moduleId,
          // La versión que el servidor tiene es la base de la comparación;
          // sin ella, cada edición parecería un conflicto.
          baseVersion: versiones[esquema.moduleId] ?? 0,
          schemaVersion: esquema.version,
          datos: limpiar(valores[esquema.moduleId] ?? {}),
        }))

      const payload: ParcelaCreateRequest = {
        id: id ?? nuevoId(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        categoria,
        ubicacion,
        gps,
        estado: 'pendiente',
        // La geometría va con la parcela, no con un módulo: es la misma
        // parcela la que tiene contorno, más allá de qué se levantó de ella.
        geometria: geometria ?? undefined,
        areaM2,
        perimetroM,
        modulos,
      }

      await onGuardar(payload)

      setNombre('')
      setDescripcion('')
      setValores({})
      setMensaje('Guardado en el dispositivo. Se sincroniza solo.')
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  if (ordenados.length === 0) {
    return (
      <p className="rounded-md px-3 py-2 text-sm" style={{ background: '#fef3c7', color: '#92400e' }}>
        No hay esquemas publicados. Un administrador tiene que publicar al menos
        uno para poder capturar.
      </p>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Campos núcleo de la parcela */}
      <div className="space-y-3">
        <div>
          <label htmlFor="parcela-nombre" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Nombre / referencia
          </label>
          <input
            id="parcela-nombre"
            required
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Casa de la esquina, parcela 14"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: '#cbd5e1' }}
          />
        </div>

        <div>
          <label htmlFor="parcela-categoria" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Categoría
          </label>
          <select
            id="parcela-categoria"
            value={categoria}
            onChange={(event) => setCategoria(event.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: '#cbd5e1' }}
          >
            {['Vivienda', 'Salud', 'Educación', 'Comercio', 'Entretenimiento', 'Cultura', 'Industria', 'Agrícola', 'Otro'].map(
              (opcion) => (
                <option key={opcion} value={opcion}>
                  {opcion}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label htmlFor="parcela-descripcion" className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Observaciones
          </label>
          <textarea
            id="parcela-descripcion"
            rows={3}
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder="Notas de campo, sin límite de largo"
            className="w-full rounded-md border px-3 py-2 text-sm"
            style={{ borderColor: '#cbd5e1' }}
          />
        </div>
      </div>

      {/* Pestañas por módulo */}
      <div>
        <div role="tablist" aria-label="Módulos" className="flex flex-wrap gap-1">
          {ordenados.map((esquema) => {
            const activo = esquema.moduleId === modulo?.moduleId
            const erroresModulo = moduloConErrores(esquema).length
            return (
              <button
                key={esquema.moduleId}
                type="button"
                role="tab"
                aria-selected={activo}
                onClick={() => setModuloActivo(esquema.moduleId)}
                className="rounded-t-md px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: activo ? '#ffffff' : '#e2e8f0',
                  color: activo ? '#1e3a5f' : '#475569',
                  borderBottom: activo ? '2px solid #1d4ed8' : '2px solid transparent',
                }}
              >
                {etiquetaModulo(esquema.moduleId)}
                {erroresModulo > 0 && (
                  <span aria-label={`${erroresModulo} errores`} style={{ color: '#b91c1c' }}>
                    {' '}
                    •
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div role="tabpanel" className="rounded-b-md bg-white p-3" style={{ border: '1px solid #e2e8f0' }}>
          {modulo?.campos
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .map((campo) => (
              <CampoControl
                key={`${modulo.moduleId}-${campo.key}`}
                campo={campo}
                valor={valores[modulo.moduleId]?.[campo.key]}
                onChange={(valor) => setValor(modulo.moduleId, campo.key, valor)}
              />
            ))}
        </div>
      </div>

      {errores.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-md px-3 py-2 text-sm" style={{ background: '#fee2e2', color: '#b91c1c' }}>
          {errores.map((error) => (
            <li key={error.key}>{error.message}</li>
          ))}
        </ul>
      )}

      {mensaje && !errores.length && (
        <p role="status" className="rounded-md px-3 py-2 text-sm" style={{ background: '#dcfce7', color: '#166534' }}>
          {mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={guardando || nombre.trim() === ''}
        className="rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        style={{ background: '#1d4ed8' }}
      >
        {guardando ? 'Guardando…' : 'Guardar parcela'}
      </button>
    </form>
  )
}

function CampoControl({
  campo,
  valor,
  onChange,
}: {
  campo: FieldDef
  valor: unknown
  onChange: (valor: unknown) => void
}) {
  const id = `campo-${campo.key}`

  return (
    <div className="mb-3">
      <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
        {campo.label}
        {campo.requerido && <span style={{ color: '#b91c1c' }}> *</span>}
      </label>

      {campo.tipo === 'texto' && (
        <textarea
          id={id}
          rows={2}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: '#cbd5e1' }}
        />
      )}

      {(campo.tipo === 'entero' || campo.tipo === 'decimal') && (
        <input
          id={id}
          type="number"
          step={campo.tipo === 'entero' ? 1 : 'any'}
          inputMode="decimal"
          value={typeof valor === 'number' || typeof valor === 'string' ? String(valor) : ''}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: '#cbd5e1' }}
        />
      )}

      {campo.tipo === 'booleano' && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            id={id}
            type="checkbox"
            checked={valor === true}
            onChange={(event) => onChange(event.target.checked)}
          />
          {valor === true ? 'Sí' : 'No'}
        </label>
      )}

      {campo.tipo === 'lista' && (
        <select
          id={id}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: '#cbd5e1' }}
        >
          <option value="">Sin dato</option>
          {(campo.opciones ?? []).map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </select>
      )}

      {campo.tipo === 'fecha' && (
        <input
          id={id}
          type="date"
          value={typeof valor === 'string' ? valor : ''}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: '#cbd5e1' }}
        />
      )}
    </div>
  )
}

function etiquetaModulo(moduleId: string): string {
  const etiquetas: Record<string, string> = {
    edificacion: 'Edificación',
    infraestructura: 'Infraestructura',
    equipamiento: 'Equipamiento',
  }
  return etiquetas[moduleId] ?? moduleId
}

/** Quita las claves vacías para no guardar ruido en el documento. */
function limpiar(datos: Record<string, unknown>): Record<string, unknown> {
  const resultado: Record<string, unknown> = {}
  for (const [key, valor] of Object.entries(datos)) {
    if (valor === undefined || valor === null) continue
    if (typeof valor === 'string' && valor.trim() === '') continue
    resultado[key] = typeof valor === 'string' ? valor.trim() : valor
  }
  return resultado
}

function nuevoId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
