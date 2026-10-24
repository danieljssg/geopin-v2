/**
 * Decisión sobre las lecturas del GPS.
 *
 * El plan pide dos cosas concretas: descartar las lecturas con más de 15
 * metros de error y permitir fijar la posición a mano cuando el sensor no
 * alcanza. Las dos son decisiones, no dibujo, así que viven acá y se prueban
 * sin navegador ni sensor.
 */

/**
 * Umbral de precisión aceptable, en metros.
 *
 * Es el número del plan. Por encima de esto el pin puede caer en la redoma
 * de al lado, que es exactamente el desfase de 30 a 60 m que se vio en las
 * pruebas de campo.
 */
export const ACCURACY_THRESHOLD_M = 15

export type AccuracyQuality = 'excelente' | 'buena' | 'imprecisa' | 'sin-dato'

export type GpsFix =
  | 'sin-soporte'
  | 'sin-permiso'
  | 'buscando'
  | 'fijado'
  | 'impreciso'
  | 'error'

export interface GpsReading {
  lat: number
  lng: number
  /** Radio de error en metros, tal como lo reporta `coords.accuracy`. */
  accuracy: number
  /** Momento de la lectura, en milisegundos. */
  timestamp: number
}

/** Origen de la posición del pin. */
export type OrigenPosicion = 'sensor' | 'manual'

/**
 * ¿La precisión alcanza para fijar el pin?
 *
 * Un `accuracy` de cero o negativo se trata como "sin dato": el dispositivo
 * está reportando algo que no es un radio real, y confiar en eso pondría el
 * pin en cualquier lado. Ante la duda, no se auto-fija y el levantador puede
 * tocar el mapa.
 */
export function isUsable(accuracy: number | undefined | null): boolean {
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy)) return false
  if (accuracy <= 0) return false
  return accuracy <= ACCURACY_THRESHOLD_M
}

/** Calidad de la lectura, para pintar el indicador. */
export function qualityOf(accuracy: number | undefined | null): AccuracyQuality {
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy <= 0) {
    return 'sin-dato'
  }
  if (accuracy <= 5) return 'excelente'
  if (accuracy <= ACCURACY_THRESHOLD_M) return 'buena'
  return 'imprecisa'
}

/**
 * ¿La lectura del sensor debe mover el pin?
 *
 * Dos motivos para no moverlo:
 *
 * 1. **La posición es manual.** El levantador ya eligió dónde va el pin.
 *    Una lectura posterior que lo moviera sería el pin saltando solo, que es
 *    peor que un pin impreciso. Para volver al sensor hay una acción
 *    explícita: el botón "usar mi ubicación".
 * 2. **La precisión no alcanza.** Mover el pin con 30 m de error es
 *    exactamente el desfase que el plan pide eliminar.
 */
export function shouldFollowSensor(
  origen: OrigenPosicion,
  reading: GpsReading | null | undefined,
  threshold: number = ACCURACY_THRESHOLD_M,
): boolean {
  if (!reading) return false
  if (origen === 'manual') return false
  if (!Number.isFinite(reading.accuracy) || reading.accuracy <= 0) return false
  return reading.accuracy <= threshold
}

/** Estado de la fijación a partir de la lectura y el error del sensor. */
export function fixFrom(
  reading: GpsReading | null | undefined,
  errorCode: number | null,
  supported: boolean,
): GpsFix {
  if (!supported) return 'sin-soporte'
  if (errorCode === 1) return 'sin-permiso'
  if (errorCode !== null && errorCode !== 0) return 'error'
  if (!reading) return 'buscando'
  return isUsable(reading.accuracy) ? 'fijado' : 'impreciso'
}

/** Texto de precisión para el indicador. */
export function formatAccuracy(accuracy: number | undefined | null): string {
  if (typeof accuracy !== 'number' || !Number.isFinite(accuracy) || accuracy <= 0) {
    return 'sin dato'
  }
  if (accuracy < 1) return '< 1 m'
  return `±${Math.round(accuracy)} m`
}

/** Mensaje para el levantador según el estado. */
export function fixMessage(fix: GpsFix): string {
  switch (fix) {
    case 'sin-soporte':
      return 'Este dispositivo no tiene GPS disponible.'
    case 'sin-permiso':
      return 'Permiso de ubicación denegado. Habilitalo en el navegador.'
    case 'buscando':
      return 'Buscando señal GPS…'
    case 'fijado':
      return 'Ubicación lista.'
    case 'impreciso':
      return `Precisión insuficiente (más de ${ACCURACY_THRESHOLD_M} m). Esperá o ubicá el pin a mano.`
    case 'error':
      return 'El GPS no pudo obtener una posición. Probá de nuevo o ubicá el pin a mano.'
  }
}
