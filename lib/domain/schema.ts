import type { FieldDef, FieldError, FieldType } from './types'

/**
 * Validación de valores contra la definición de un campo del esquema.
 *
 * Todo en este módulo es puro: ni toca la red ni el almacenamiento, para poder
 * reutilizarlo tal cual en el cliente de campo, en la API y en los tests.
 */

/**
 * Límite de seguridad del campo `texto`. No es un límite de usabilidad — el
 * campo de notas de campo sigue aceptando texto largo — sino el techo para
 * que un documento no supere el límite de 2 MB de Cosmos.
 */
export const MAX_TEXT_LENGTH = 20_000

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  texto: 'Texto libre',
  entero: 'Entero',
  decimal: 'Decimal',
  booleano: 'Booleano',
  lista: 'Lista desplegable',
  fecha: 'Fecha',
}

/** Una cadena vacía o solo espacios cuenta como valor ausente. */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  return false
}

/**
 * Valida un valor contra el tipo declarado por el campo.
 * Devuelve `null` cuando el valor es válido, o el mensaje de error.
 */
export function validateFieldValue(campo: FieldDef, value: unknown): string | null {
  if (isBlank(value)) {
    return campo.requerido ? `${campo.label} es obligatorio.` : null
  }

  switch (campo.tipo) {
    case 'texto': {
      if (typeof value !== 'string') return `${campo.label} debe ser texto.`
      if (value.length > MAX_TEXT_LENGTH) {
        return `${campo.label} no puede superar ${MAX_TEXT_LENGTH.toLocaleString('es-VE')} caracteres.`
      }
      return null
    }

    case 'entero': {
      const num = toNumber(value)
      if (num === null) return `${campo.label} debe ser un número entero.`
      if (!Number.isInteger(num)) return `${campo.label} debe ser un número entero.`
      return null
    }

    case 'decimal': {
      const num = toNumber(value)
      if (num === null) return `${campo.label} debe ser un número.`
      return null
    }

    case 'booleano': {
      if (typeof value !== 'boolean') return `${campo.label} debe ser verdadero o falso.`
      return null
    }

    case 'lista': {
      if (typeof value !== 'string') return `${campo.label} debe ser una de las opciones.`
      const opciones = campo.opciones ?? []
      if (!opciones.includes(value)) return `${campo.label} debe ser una de las opciones.`
      return null
    }

    case 'fecha': {
      if (typeof value !== 'string') return `${campo.label} debe ser una fecha.`
      const parsed = Date.parse(value)
      if (Number.isNaN(parsed)) return `${campo.label} debe ser una fecha válida.`
      return null
    }

    default: {
      const exhaustive: never = campo.tipo
      return `Tipo de campo desconocido: ${String(exhaustive)}.`
    }
  }
}

/**
 * Valida un conjunto de datos contra los campos de un módulo.
 * Devuelve todos los errores encontrados, no solo el primero.
 */
export function validateModuleData(
  campos: readonly FieldDef[],
  datos: Record<string, unknown>,
): FieldError[] {
  const errors: FieldError[] = []

  for (const campo of campos) {
    const message = validateFieldValue(campo, datos[campo.key])
    if (message) errors.push({ key: campo.key, message })
  }

  return errors
}

/**
 * Normaliza un valor de entrada cruda (texto del formulario) al tipo declarado
 * por el campo. Devuelve `undefined` cuando el valor está vacío, para que el
 * documento almacenado no cargue claves sin contenido.
 */
export function coerceFieldValue(campo: FieldDef, raw: unknown): unknown {
  if (isBlank(raw)) return undefined

  switch (campo.tipo) {
    case 'entero': {
      const num = toNumber(raw)
      return num === null ? raw : Math.trunc(num)
    }
    case 'decimal': {
      const num = toNumber(raw)
      return num === null ? raw : num
    }
    case 'booleano': {
      if (typeof raw === 'boolean') return raw
      if (raw === 'true') return true
      if (raw === 'false') return false
      return raw
    }
    default:
      return typeof raw === 'string' ? raw.trim() : raw
  }
}

/**
 * Convierte un valor de entrada a número. Acepta el string que produce un
 * `<input type="number">` y el separador decimal coma, que es el que usa el
 * formulario en español.
 */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (trimmed === '') return null

  const normalized = trimmed.replace(',', '.')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}
