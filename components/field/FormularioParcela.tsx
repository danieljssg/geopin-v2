'use client'

import { useMemo, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import type { ParcelaCreateRequest } from '@/lib/api/contracts'
import { validateModuleData } from '@/lib/domain/schema'
import type { FieldDef, FieldError, GeoPolygon, ModuleSchema, Parcela } from '@/lib/domain/types'

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
  /** Parcela que se está editando: precarga el formulario. */
  initial?: Parcela | null
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
  initial,
  ubicacion,
  gps,
  versiones,
  geometria,
  areaM2,
  perimetroM,
  onGuardar,
}: FormularioParcelaProps) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '')
  const [categoria, setCategoria] = useState(initial?.categoria ?? 'Vivienda')
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '')
  const [valores, setValores] = useState<Valores>(() => valoresIniciales(initial))
  const [errores, setErrores] = useState<FieldError[]>([])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)

  /**
   * Las versiones que el servidor tiene de cada módulo. Si se está editando,
   * salen de la propia parcela: son las que el cliente debe mandar como
   * `baseVersion` para que el servidor detecte el conflicto si alguien más
   * editó ese módulo mientras tanto.
   */
  const versionesEfectivas = useMemo<Record<string, number>>(() => {
    if (versiones) return versiones
    if (!initial) return {}

    const resultado: Record<string, number> = {}
    for (const [moduleId, modulo] of Object.entries(initial.modulos ?? {})) {
      resultado[moduleId] = modulo.version
    }
    return resultado
  }, [versiones, initial])

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
          baseVersion: versionesEfectivas[esquema.moduleId] ?? 0,
          schemaVersion: esquema.version,
          datos: limpiar(valores[esquema.moduleId] ?? {}),
        }))

      const payload: ParcelaCreateRequest = {
        id: id ?? initial?.id ?? nuevoId(),
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
      <Alert>
        <AlertDescription>
          No hay esquemas publicados. Un administrador tiene que publicar al menos uno para poder
          capturar.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {/* Campos núcleo de la parcela */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="parcela-nombre" className="mb-1.5">
            Nombre / referencia
          </Label>
          <Input
            id="parcela-nombre"
            required
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
            placeholder="Casa de la esquina, parcela 14"
          />
        </div>

        <div>
          <Label htmlFor="parcela-categoria" className="mb-1.5">
            Categoría
          </Label>
          <Select
            value={categoria}
            onValueChange={(value) => {
              if (value !== null) setCategoria(value)
            }}
          >
            <SelectTrigger id="parcela-categoria" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['Vivienda', 'Salud', 'Educación', 'Comercio', 'Entretenimiento', 'Cultura', 'Industria', 'Agrícola', 'Otro'].map(
                (opcion) => (
                  <SelectItem key={opcion} value={opcion}>
                    {opcion}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="parcela-descripcion" className="mb-1.5">
            Observaciones
          </Label>
          <Textarea
            id="parcela-descripcion"
            rows={3}
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder="Notas de campo, sin límite de largo"
          />
        </div>
      </div>

      {/* Pestañas por módulo */}
      <Tabs value={modulo.moduleId} onValueChange={(value) => setModuloActivo(value as string)}>
        <TabsList aria-label="Módulos">
          {ordenados.map((esquema) => {
            const erroresModulo = moduloConErrores(esquema).length
            return (
              <TabsTrigger key={esquema.moduleId} value={esquema.moduleId}>
                {etiquetaModulo(esquema.moduleId)}
                {erroresModulo > 0 && (
                  <span aria-label={`${erroresModulo} errores`} className="text-destructive">
                    {' '}
                    •
                  </span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value={modulo.moduleId} className="rounded-lg border border-border bg-card p-3">
          {modulo.campos
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
        </TabsContent>
      </Tabs>

      {errores.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="space-y-1">
              {errores.map((error) => (
                <li key={error.key}>{error.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {mensaje && !errores.length && (
        // `role="status"` reemplaza el `role="alert"` que trae Alert: el
        // guardado exitoso se anuncia sin interrumpir.
        <Alert role="status">
          <AlertDescription>{mensaje}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={guardando || nombre.trim() === ''}>
        {guardando ? 'Guardando…' : 'Guardar parcela'}
      </Button>
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
      <Label htmlFor={id} className="mb-1.5">
        {campo.label}
        {campo.requerido && <span className="text-destructive"> *</span>}
      </Label>

      {campo.tipo === 'texto' && (
        <Textarea
          id={id}
          rows={2}
          value={typeof valor === 'string' ? valor : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {(campo.tipo === 'entero' || campo.tipo === 'decimal') && (
        <Input
          id={id}
          type="number"
          step={campo.tipo === 'entero' ? 1 : 'any'}
          inputMode="decimal"
          value={typeof valor === 'number' || typeof valor === 'string' ? String(valor) : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )}

      {campo.tipo === 'booleano' && (
        <div className="flex items-center gap-2">
          <Switch
            id={id}
            checked={valor === true}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <Label htmlFor={id}>{valor === true ? 'Sí' : 'No'}</Label>
        </div>
      )}

      {campo.tipo === 'lista' && (
        <Select
          value={typeof valor === 'string' ? valor : ''}
          onValueChange={(value) => onChange(value)}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue>
              {(value) => (typeof value === 'string' && value !== '' ? value : 'Sin dato')}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Sin dato</SelectItem>
            {(campo.opciones ?? []).map((opcion) => (
              <SelectItem key={opcion} value={opcion}>
                {opcion}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {campo.tipo === 'fecha' && (
        <Input
          id={id}
          type="date"
          value={typeof valor === 'string' ? valor : ''}
          onChange={(event) => onChange(event.target.value)}
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

/** Los datos de los módulos de una parcela, listos para editar. */
function valoresIniciales(parcela: Parcela | null | undefined): Valores {
  if (!parcela?.modulos) return {}

  const resultado: Valores = {}
  for (const [moduleId, modulo] of Object.entries(parcela.modulos)) {
    resultado[moduleId] = { ...modulo.datos }
  }
  return resultado
}
