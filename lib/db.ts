import Dexie, { type Table } from 'dexie'
import type { Pin, PinFormData } from './types'
import { normalizeCategory } from './categories'
import { parsePoblacionRango } from './urban-options'

/**
 * Base de datos local en el navegador (IndexedDB) usando Dexie.
 * Reemplaza el archivo pins.json del servidor, permitiendo que los datos
 * persistan en el dispositivo del usuario incluso en producción/despliegue.
 */
class GeoPinDB extends Dexie {
  pins!: Table<Pin, string>

  constructor() {
    super('geopin')
    this.version(1).stores({
      // 'id' es la clave primaria; indexamos categoria y creadoEn para consultas
      pins: 'id, categoria, creadoEn',
    })
  }
}

export const db = new GeoPinDB()

/** Genera un id único para un pin. */
function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Devuelve todos los pines ordenados por fecha de creación (más antiguos primero). */
export async function getAllPins(): Promise<Pin[]> {
  return db.pins.orderBy('creadoEn').toArray()
}

function preparePinData(data: PinFormData) {
  const rawRange = data.poblacionRango?.trim()
  const population = rawRange ? parsePoblacionRango(rawRange) : null
  if (rawRange && !population) {
    throw new Error('La población debe ser un rango consecutivo entre 0 y 10, por ejemplo 2-3.')
  }

  return {
    ...data,
    nombre: data.nombre.trim(),
    descripcion: data.descripcion.trim(),
    categoria: normalizeCategory(data.categoria),
    drenaje: data.drenaje?.trim() || undefined,
    poblacionRango: population?.rango,
    poblacionPromedio: population?.promedio,
  }
}

/** Crea y guarda un nuevo pin a partir de los datos del formulario. */
export async function addPin(data: PinFormData): Promise<Pin> {
  const pin: Pin = {
    ...preparePinData(data),
    id: generateId(),
    creadoEn: new Date().toISOString(),
  }
  await db.pins.add(pin)
  return pin
}

/** Actualiza un pin existente sin recrearlo si fue eliminado. */
export async function updatePin(id: string, data: PinFormData): Promise<Pin> {
  return db.transaction('rw', db.pins, async () => {
    const existing = await db.pins.get(id)
    if (!existing) throw new Error('El pin ya no existe. Cancela la edición y vuelve a intentarlo.')

    const updated: Pin = {
      ...existing,
      ...preparePinData(data),
      id: existing.id,
      creadoEn: existing.creadoEn,
    }
    if (updated.poblacionRango) delete updated.poblacion

    const changed = await db.pins.update(id, updated)
    if (changed === 0) throw new Error('El pin ya no existe. Cancela la edición y vuelve a intentarlo.')
    return updated
  })
}

/** Elimina un pin por su id. */
export async function deletePin(id: string): Promise<void> {
  await db.pins.delete(id)
}

/** Elimina todos los pines. */
export async function clearPins(): Promise<void> {
  await db.pins.clear()
}
