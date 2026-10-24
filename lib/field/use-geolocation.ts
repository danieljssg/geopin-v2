'use client'

import { useCallback, useEffect, useState } from 'react'
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
   * Si el navegador tiene GPS se deriva del entorno en vez de guardarlo en
   * estado: ponerlo en estado exigía un setState dentro del efecto, que
   * React 19 marca porque provoca un render en cascada.
   *
   * Durante el prerender del servidor `navigator` no existe y se asume que
   * sí lo hay: un navegador sin geolocation es un caso excepcional.
   */
  const supported = typeof navigator === 'undefined' || 'geolocation' in navigator

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
