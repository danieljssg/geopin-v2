import type { FieldDef, FieldType, ModuleSchema, ModuloId } from './types'

/**
 * Edición de esquemas.
 *
 * El administrador de esquemas cambia los campos de un módulo sin desplegar
 * código. Toda la lógica de edición es pura y vive acá: agregar, mover,
 * borrar y validar campos. La UI solo dibuja y llama.
 */

export const FIELD_TYPES: readonly FieldType[] = [
  'texto',
  'entero',
  'decimal',
  'booleano',
  'lista',
  'fecha',
]

export const MODULOS: readonly { id: ModuloId; label: string }[] = [
  { id: 'edificacion', label: 'Edificación' },
  { id: 'infraestructura', label: 'Infraestructura' },
  { id: 'equipamiento', label: 'Equipamiento' },
]

export interface SchemaDraftError {
  /** Campo al que se refiere el error, o `'*'` si es del módulo entero. */
  campo: string
  message: string
}

const MAX_KEY = 60
const MAX_LABEL = 120
const MAX_OPCIONES = 60
const KEY_PATTERN = /^[a-z][a-z0-9_]*$/

/**
 * Convierte la etiqueta de un campo en una clave estable.
 *
 * La clave se usa como nombre de propiedad en el documento, así que no puede
 * tener acentos, espacios ni mayúsculas. Se conserva aunque después se
 * edite la etiqueta: renombrar la etiqueta no puede mover los datos ya
 * capturados.
 *
 * Es determinista a propósito: la misma etiqueta produce siempre la misma
 * clave. Si dos campos terminan con la misma clave, la validación del módulo
 * lo reporta como duplicado en vez de inventar un sufijo.
 */
export function slugifyFieldKey(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (base === '') return 'campo'
  if (!/^[a-z]/.test(base)) return `campo_${base}`.slice(0, MAX_KEY)
  return base.slice(0, MAX_KEY)
}

/** Valida el conjunto de campos de un módulo. */
export function validateSchemaFields(campos: readonly FieldDef[]): SchemaDraftError[] {
  const errores: SchemaDraftError[] = []
  const vistas = new Set<string>()

  if (campos.length === 0) {
    errores.push({ campo: '*', message: 'El módulo necesita al menos un campo.' })
    return errores
  }

  for (const campo of campos) {
    const key = campo.key.trim()

    if (key === '') {
      errores.push({ campo: campo.key || '*', message: 'La clave del campo está vacía.' })
    } else if (!KEY_PATTERN.test(key)) {
      errores.push({
        campo: key,
        message: `La clave "${key}" solo admite minúsculas, números y guiones bajos, y tiene que empezar con una letra.`,
      })
    } else if (key.length > MAX_KEY) {
      errores.push({ campo: key, message: `La clave no puede superar ${MAX_KEY} caracteres.` })
    }

    if (vistas.has(key)) {
      errores.push({ campo: key, message: `La clave "${key}" está repetida.` })
    }
    vistas.add(key)

    const label = campo.label.trim()
    if (label === '') {
      errores.push({ campo: key, message: 'La etiqueta no puede estar vacía.' })
    } else if (label.length > MAX_LABEL) {
      errores.push({ campo: key, message: `La etiqueta no puede superar ${MAX_LABEL} caracteres.` })
    }

    if (!FIELD_TYPES.includes(campo.tipo)) {
      errores.push({ campo: key, message: `El tipo "${campo.tipo}" no es válido.` })
    }

    if (campo.tipo === 'lista') {
      const opciones = campo.opciones ?? []
      if (opciones.length === 0) {
        errores.push({ campo: key, message: 'Una lista necesita al menos una opción.' })
      }
      if (opciones.length > MAX_OPCIONES) {
        errores.push({ campo: key, message: `Una lista no puede superar ${MAX_OPCIONES} opciones.` })
      }
      if (opciones.some((opcion) => opcion.trim() === '')) {
        errores.push({ campo: key, message: 'Las opciones no pueden estar vacías.' })
      }
      if (new Set(opciones.map((o) => o.trim())).size !== opciones.length) {
        errores.push({ campo: key, message: 'Las opciones de la lista están repetidas.' })
      }
    }
  }

  return errores
}

/** Agrega un campo al final, con el orden correcto. */
export function addField(campos: readonly FieldDef[], field: Omit<FieldDef, 'orden'>): FieldDef[] {
  return normalizeOrder([...campos, { ...field, orden: campos.length + 1 }])
}

/** Modifica un campo existente. La clave no cambia. */
export function updateField(
  campos: readonly FieldDef[],
  key: string,
  patch: Partial<Omit<FieldDef, 'key'>>,
): FieldDef[] {
  return campos.map((campo) => (campo.key === key ? { ...campo, ...patch } : campo))
}

/** Borra un campo y reordena el resto. */
export function removeField(campos: readonly FieldDef[], key: string): FieldDef[] {
  return normalizeOrder(campos.filter((campo) => campo.key !== key))
}

/** Mueve un campo una posición arriba o abajo. */
export function moveField(
  campos: readonly FieldDef[],
  key: string,
  direccion: -1 | 1,
): FieldDef[] {
  const ordenados = normalizeOrder([...campos])
  const indice = ordenados.findIndex((campo) => campo.key === key)
  if (indice === -1) return ordenados

  const destino = indice + direccion
  if (destino < 0 || destino >= ordenados.length) return ordenados

  const copia = [...ordenados]
  const [movido] = copia.splice(indice, 1)
  copia.splice(destino, 0, movido)
  return normalizeOrder(copia)
}

/** Reescribe `orden` para que sea contiguo desde 1 y según la posición. */
export function normalizeOrder(campos: readonly FieldDef[]): FieldDef[] {
  return campos.map((campo, indice) => ({ ...campo, orden: indice + 1 }))
}

/**
 * Construye el esquema publicado a partir de los campos editados.
 *
 * Cada guardado sube la versión. La app de campo guarda la versión con la
 * que capturó cada visita, así que subirla es lo que permite distinguir un
 * dato viejo de uno nuevo.
 */
export function draftToSchema(input: {
  moduleId: string
  modulo: ModuloId
  campos: readonly FieldDef[]
  versionActual: number
  actor: string
  now: string
}): ModuleSchema {
  return {
    moduleId: input.moduleId,
    modulo: input.modulo,
    version: input.versionActual + 1,
    campos: normalizeOrder(input.campos),
    actualizadoEn: input.now,
    actualizadoPor: input.actor,
  }
}

/** ¿Cambió algo respecto del esquema publicado? */
export function schemasDiffer(
  publicado: readonly FieldDef[],
  borrador: readonly FieldDef[],
): boolean {
  if (publicado.length !== borrador.length) return true

  return publicado.some((campo, indice) => {
    const otro = borrador[indice]
    if (!otro) return true
    return (
      campo.key !== otro.key ||
      campo.label !== otro.label ||
      campo.tipo !== otro.tipo ||
      Boolean(campo.requerido) !== Boolean(otro.requerido) ||
      (campo.opciones ?? []).join('\u0000') !== (otro.opciones ?? []).join('\u0000')
    )
  })
}
