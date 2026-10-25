'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { fixFrom, type GpsFix, type GpsReading } from '@/lib/domain/gps'

/**
 * Lectura continua del GPS.
 *
 * Usa `watchPosition` y no `getCurrentPosition`: la primera lectura de un
 * sensor recién encendido suele tener decenas de metros de error y mejora a
 * los pocos segundos. Con una sola lectura habría que elegir entre esperar a
 * ciegas o aceptar el error; con el watch el pin se corrige solo cuando la
 * precisión entra en el umbral.
 */

export interface UseGeolocationOptions {
  enabled?: boolean
}

export interface UseGeolocationResult {
  fix: GpsFix
  reading: GpsReading | null
  supported: boolean
  /** Código de error del navegador: 1 permiso, 2 no disponible, 3 timeout. */
  errorCode: number | null
  reiniciar: () => void
}

export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationResult {
  const { enabled = true } = options
  const [reading, setReading] = useState<GpsReading | null>(null)
  const [errorCode, setErrorCode] = useState<number | null>(null)
  const [intento, setIntento] = useState(0)

  /**
   * Si el navegador tiene GPS.
   *
   * Se lee con `useSyncExternalStore` y no directamente en el render:
   * **Node 24 expone un `navigator` global sin `geolocation`**, así que una
   * comprobación directa daba `false` en el servidor y `true` en el cliente,
   * y React rompía por hidratación.
   *
   * `getServerSnapshot` se usa también en el primer render del cliente, así
   * que el HTML del servidor y la primera pintura coinciden. Después React
   * re-renderiza con el valor real.
   */
  const supported = useSyncExternalStore(
    () => () => {},
    () => typeof navigator !== 'undefined' && 'geolocation' in navigator,
    () => true,
  )

  useEffect(() => {
    if (!enabled) return

    if (!supported || !navigator.geolocation) return

    let watchId: number | null = null

    try {
      watchId = navigator.geolocation.watchPosition(
        (posicion) => {
          setErrorCode(null)
          setReading({
            lat: posicion.coords.latitude,
            lng: posicion.coords.longitude,
            accuracy: posicion.coords.accuracy,
            timestamp: posicion.timestamp,
          })
        },
        (error) => {
          setErrorCode(error.code)
        },
        {
          enableHighAccuracy: true,
          // Una lectura de hace 5 s sirve para ubicar; una de hace un minuto
          // puede ser de otra cuadra.
          maximumAge: 5_000,
          timeout: 20_000,
        },
      )
    } catch {
      // El watch no arrancó: la lectura queda sin datos y el error se ve en
      // el indicador.
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [enabled, intento, supported])

  const reiniciar = useCallback(() => {
    setReading(null)
    setErrorCode(null)
    setIntento((valor) => valor + 1)
  }, [])

  return {
    fix: fixFrom(reading, errorCode, supported),
    reading,
    supported,
    errorCode,
    reiniciar,
  }
}
