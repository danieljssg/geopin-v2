import Dexie, { type Table } from 'dexie'
import type { Pin, PinFormData } from './types'

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

/** Crea y guarda un nuevo pin a partir de los datos del formulario. */
export async function addPin(data: PinFormData): Promise<Pin> {
  const pin: Pin = {
    id: generateId(),
    lat: data.lat,
    lng: data.lng,
    nombre: data.nombre,
    descripcion: data.descripcion,
    categoria: data.categoria,
    creadoEn: new Date().toISOString(),
  }
  await db.pins.add(pin)
  return pin
}

/** Elimina un pin por su id. */
export async function deletePin(id: string): Promise<void> {
  await db.pins.delete(id)
}

/** Elimina todos los pines. */
export async function clearPins(): Promise<void> {
  await db.pins.clear()
}
