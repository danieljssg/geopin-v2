/**
 * Comparación de valores JSON.
 *
 * Se usa para decidir si dos escrituras de un módulo son la misma: si el
 * cliente reintenta un envío que el servidor ya aplicó, los datos llegan
 * idénticos y el resultado debe ser un no-op, no un conflicto.
 */

/**
 * Quita las claves con valor `undefined`, en profundidad.
 *
 * Importa para la base de datos: el driver de MongoDB serializa `undefined`
 * como `null`, y un índice único `sparse` **sí** indexa los `null`. Una
 * parcela sin código catastral escrita como `codigo: null` choca con la
 * siguiente parcela sin código. Omitir la clave hace que el sparse funcione
 * como se espera: no indexa lo que no existe.
 *
 * Los `null` explícitos se conservan: significan "vacío a propósito", que es
 * distinto de "no se levantó".
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T
  }

  if (value !== null && typeof value === 'object') {
    const resultado: Record<string, unknown> = {}

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue
      resultado[key] = stripUndefinedDeep(item)
    }

    return resultado as T
  }

  return value
}

/** Compara dos valores con forma de JSON. */
export function jsonEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true

  if (a === null || b === null || a === undefined || b === undefined) {
    // undefined y null se consideran distintos a propósito: uno es "ausente"
    // y el otro es "explícitamente vacío".
    return false
  }

  if (typeof a !== typeof b) return false

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    return a.every((item, index) => jsonEquals(item, b[index]))
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>)
    const bKeys = Object.keys(b as Record<string, unknown>)
    if (aKeys.length !== bKeys.length) return false

    return aKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(b, key) &&
        jsonEquals(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key],
        ),
    )
  }

  if (typeof a === 'number' && typeof b === 'number') {
    // NaN no es igual a nada, ni siquiera a sí mismo.
    return Number.isNaN(a) ? Number.isNaN(b) : a === b
  }

  return false
}
